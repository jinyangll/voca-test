import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["ADMIN_PASSWORD"] = "secret-pw"
os.environ["JWT_SECRET"] = "test-jwt-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import grading, llm  # noqa: E402
from backend.db import Base, engine  # noqa: E402
from backend.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def login(ip="1.1.1.1"):
    r = client.post("/api/admin/login", json={"password": "secret-pw"}, headers={"x-forwarded-for": ip})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def make_book(h, words, active=True):
    wb = client.post("/api/admin/wordbooks", json={"name": "10월 5주차"}, headers=h).json()
    client.post(f"/api/admin/wordbooks/{wb['id']}/words", json={"words": words}, headers=h)
    client.patch(f"/api/admin/wordbooks/{wb['id']}", json={"is_active": active}, headers=h)
    return wb["id"]


# F-16
def test_rule_match():
    assert grading.rule_match("달리다", "달리다, 운영하다")
    assert grading.rule_match(" 운영 하다. ", "달리다, 운영하다")
    assert not grading.rule_match("먹다", "달리다, 운영하다")
    assert not grading.rule_match("  ", "달리다")


# NF-02
def test_admin_requires_token():
    assert client.get("/api/admin/wordbooks").status_code == 401
    assert client.get("/api/admin/wordbooks", headers={"Authorization": "Bearer bad"}).status_code == 401


# NF-03
def test_login_lockout():
    h = {"x-forwarded-for": "9.9.9.9"}
    for _ in range(4):
        assert client.post("/api/admin/login", json={"password": "x"}, headers=h).status_code == 401
    assert client.post("/api/admin/login", json={"password": "x"}, headers=h).status_code == 429
    # 차단 중에는 맞는 비밀번호도 거부
    assert client.post("/api/admin/login", json={"password": "secret-pw"}, headers=h).status_code == 429
    # 다른 IP는 영향 없음
    login("8.8.8.8")


# F-12, NF-05
def test_exam_hides_meanings_and_inactive():
    h = login()
    active = make_book(h, [{"english": "apple", "meanings": "사과"}])
    inactive = make_book(h, [{"english": "run", "meanings": "달리다"}], active=False)

    books = client.get("/api/exam/wordbooks").json()
    assert [b["id"] for b in books] == [active]

    exam = client.get(f"/api/exam/wordbooks/{active}").json()
    assert exam["time_limit"] == 10
    assert exam["words"] == [{"id": exam["words"][0]["id"], "english": "apple"}]
    assert "사과" not in str(exam)
    assert client.get(f"/api/exam/wordbooks/{inactive}").status_code == 404


# F-16~18, F-22, F-23, F-10, F-11
def test_submit_grading_and_correction(monkeypatch):
    h = login()
    book = make_book(h, [
        {"english": "apple", "meanings": "사과"},
        {"english": "beautiful", "meanings": "아름다운"},
        {"english": "run", "meanings": "달리다, 운영하다"},
        {"english": "fast", "meanings": "빠른"},
    ])
    ids = {w["english"]: w["id"] for w in client.get(f"/api/exam/wordbooks/{book}").json()["words"]}

    sent = []

    def fake_judge(items):
        sent.extend(items)
        return {it["id"]: (it["answer"] == "아름답다", "활용형 차이") for it in items}

    monkeypatch.setattr(llm, "judge", fake_judge)
    r = client.post("/api/exam/submit", json={"wordbook_id": book, "answers": [
        {"word_id": ids["apple"], "answer": "사과"},
        {"word_id": ids["beautiful"], "answer": "아름답다", "left_tab": True},
        {"word_id": ids["run"], "answer": "", "dont_know": True},
        {"word_id": ids["fast"], "answer": "이른"},
    ]}).json()

    # 규칙 통과·모르겠어요는 LLM에 보내지 않음
    assert sorted(it["answer"] for it in sent) == ["아름답다", "이른"]
    assert (r["correct_count"], r["total"]) == (2, 4)
    by = {x["english"]: x for x in r["items"]}
    assert by["apple"]["method"] == "rule" and by["apple"]["is_correct"]
    assert by["beautiful"]["method"] == "llm" and by["beautiful"]["is_correct"]
    assert by["run"]["dont_know"] and not by["run"]["is_correct"]
    assert not by["fast"]["is_correct"]

    attempts = client.get("/api/admin/attempts", headers=h).json()
    assert attempts[0]["left_tab_count"] == 1

    detail = client.get(f"/api/admin/attempts/{r['attempt_id']}", headers=h).json()
    fast = next(x for x in detail["answers"] if x["english"] == "fast")
    fixed = client.patch(f"/api/admin/answers/{fast['id']}", json={"is_correct": True}, headers=h).json()
    assert fixed["correct_count"] == 3


def test_llm_failure_marks_needs_review(monkeypatch):
    h = login()
    book = make_book(h, [{"english": "beautiful", "meanings": "아름다운"}])
    wid = client.get(f"/api/exam/wordbooks/{book}").json()["words"][0]["id"]

    def boom(items):
        raise llm.LLMError("down")

    monkeypatch.setattr(llm, "judge", boom)
    r = client.post("/api/exam/submit", json={"wordbook_id": book, "answers": [
        {"word_id": wid, "answer": "아름답다"}]}).json()
    assert r["items"][0]["needs_review"] and not r["items"][0]["is_correct"]


# F-07, F-09
def test_copy_and_delete_keeps_attempts(monkeypatch):
    h = login()
    book = make_book(h, [{"english": "apple", "meanings": "사과"}])
    copy = client.post(f"/api/admin/wordbooks/{book}/copy", json={"name": "복사본"}, headers=h).json()
    assert copy["word_count"] == 1 and not copy["is_active"]

    wid = client.get(f"/api/exam/wordbooks/{book}").json()["words"][0]["id"]
    client.post("/api/exam/submit", json={"wordbook_id": book, "answers": [{"word_id": wid, "answer": "사과"}]})
    client.delete(f"/api/admin/wordbooks/{book}", headers=h)
    attempts = client.get("/api/admin/attempts", headers=h).json()
    assert len(attempts) == 1 and attempts[0]["wordbook_id"] is None
