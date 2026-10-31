import random
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import auth, grading, llm
from .db import Answer, Attempt, Word, Wordbook, as_utc, get_db

app = FastAPI(title="영어 단어 시험")
admin = [Depends(auth.require_admin)]


def iso(dt: datetime | None) -> str | None:
    return as_utc(dt).isoformat() if dt else None


def get_or_404(db: Session, model, id: int):
    obj = db.get(model, id)
    if obj is None:
        raise HTTPException(404, "찾을 수 없습니다")
    return obj


# ---------- 스키마 ----------

class LoginIn(BaseModel):
    password: str


class WordIn(BaseModel):
    english: str = Field(min_length=1, max_length=100)
    meanings: str = Field(min_length=1)


class WordsIn(BaseModel):
    words: list[WordIn] = Field(min_length=1)


class WordbookIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WordbookPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None
    time_limit: int | None = Field(default=None, ge=3, le=120)


class CopyIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AutofillIn(BaseModel):
    words: list[str] = Field(min_length=1, max_length=100)


class SubmitAnswer(BaseModel):
    word_id: int
    answer: str = ""
    dont_know: bool = False
    left_tab: bool = False


class SubmitIn(BaseModel):
    wordbook_id: int
    started_at: datetime | None = None
    answers: list[SubmitAnswer] = Field(min_length=1)


class AnswerPatch(BaseModel):
    is_correct: bool


# ---------- 직렬화 ----------

def wordbook_summary(wb: Wordbook, word_count: int) -> dict:
    return {"id": wb.id, "name": wb.name, "is_active": wb.is_active,
            "time_limit": wb.time_limit, "word_count": word_count, "created_at": iso(wb.created_at)}


def word_out(w: Word) -> dict:
    return {"id": w.id, "english": w.english, "meanings": w.meanings}


def attempt_summary(a: Attempt) -> dict:
    return {"id": a.id, "wordbook_id": a.wordbook_id, "wordbook_name": a.wordbook_name,
            "started_at": iso(a.started_at), "finished_at": iso(a.finished_at),
            "correct_count": a.correct_count, "total": a.total,
            "needs_review": any(x.needs_review for x in a.answers),
            "left_tab_count": sum(x.left_tab for x in a.answers)}


def answer_out(x: Answer) -> dict:
    return {"id": x.id, "english": x.english, "meanings": x.meanings, "user_answer": x.user_answer,
            "dont_know": x.dont_know, "is_correct": x.is_correct, "method": x.method,
            "needs_review": x.needs_review, "reason": x.reason, "left_tab": x.left_tab}


def word_counts(db: Session) -> dict[int, int]:
    return dict(db.execute(select(Word.wordbook_id, func.count()).group_by(Word.wordbook_id)).all())


# ---------- 학생용 ----------

@app.get("/api/exam/wordbooks")
def exam_wordbooks(db: Session = Depends(get_db)):
    counts = word_counts(db)
    books = db.scalars(select(Wordbook).where(Wordbook.is_active).order_by(Wordbook.created_at.desc()))
    return [wordbook_summary(wb, counts.get(wb.id, 0)) for wb in books if counts.get(wb.id)]


@app.get("/api/exam/wordbooks/{wordbook_id}")
def exam_start(wordbook_id: int, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, wordbook_id)
    if not wb.is_active:
        raise HTTPException(404, "지금은 풀 수 없는 단어장이에요")
    words = [{"id": w.id, "english": w.english} for w in wb.words]  # NF-05: 뜻은 내려주지 않음
    random.shuffle(words)
    return {"id": wb.id, "name": wb.name, "time_limit": wb.time_limit, "words": words}


@app.post("/api/exam/submit")
def exam_submit(body: SubmitIn, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, body.wordbook_id)
    words = {w.id: w for w in wb.words}
    items = [
        {"english": words[a.word_id].english, "meanings": words[a.word_id].meanings,
         "answer": a.answer.strip(), "dont_know": a.dont_know, "left_tab": a.left_tab}
        for a in body.answers if a.word_id in words
    ]
    if not items:
        raise HTTPException(400, "채점할 답이 없어요")
    grading.grade(items)

    attempt = Attempt(wordbook_id=wb.id, wordbook_name=wb.name, started_at=body.started_at,
                      correct_count=sum(it["is_correct"] for it in items), total=len(items))
    attempt.answers = [
        Answer(position=i, english=it["english"], meanings=it["meanings"], user_answer=it["answer"],
               dont_know=it["dont_know"], is_correct=it["is_correct"], method=it["method"],
               needs_review=it["needs_review"], reason=it["reason"], left_tab=it["left_tab"])
        for i, it in enumerate(items)
    ]
    db.add(attempt)
    db.commit()
    return {"attempt_id": attempt.id, "wordbook_name": wb.name, "correct_count": attempt.correct_count,
            "total": attempt.total, "items": [answer_out(x) for x in attempt.answers]}


# ---------- 관리자 ----------

@app.post("/api/admin/login")
def admin_login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    return {"token": auth.login(db, ip, body.password)}


@app.get("/api/admin/wordbooks", dependencies=admin)
def list_wordbooks(db: Session = Depends(get_db)):
    counts = word_counts(db)
    books = db.scalars(select(Wordbook).order_by(Wordbook.created_at.desc()))
    return [wordbook_summary(wb, counts.get(wb.id, 0)) for wb in books]


@app.post("/api/admin/wordbooks", dependencies=admin)
def create_wordbook(body: WordbookIn, db: Session = Depends(get_db)):
    wb = Wordbook(name=body.name.strip())
    db.add(wb)
    db.commit()
    return wordbook_summary(wb, 0)


@app.get("/api/admin/wordbooks/{wordbook_id}", dependencies=admin)
def get_wordbook(wordbook_id: int, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, wordbook_id)
    return {**wordbook_summary(wb, len(wb.words)), "words": [word_out(w) for w in wb.words]}


@app.patch("/api/admin/wordbooks/{wordbook_id}", dependencies=admin)
def update_wordbook(wordbook_id: int, body: WordbookPatch, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, wordbook_id)
    if body.name is not None:
        wb.name = body.name.strip()
    if body.is_active is not None:
        wb.is_active = body.is_active
    if body.time_limit is not None:
        wb.time_limit = body.time_limit
    db.commit()
    return wordbook_summary(wb, len(wb.words))


@app.delete("/api/admin/wordbooks/{wordbook_id}", dependencies=admin)
def delete_wordbook(wordbook_id: int, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, wordbook_id)
    for a in db.scalars(select(Attempt).where(Attempt.wordbook_id == wb.id)):
        a.wordbook_id = None  # 응시 기록은 남긴다
    db.delete(wb)
    db.commit()
    return {"ok": True}


@app.post("/api/admin/wordbooks/{wordbook_id}/copy", dependencies=admin)
def copy_wordbook(wordbook_id: int, body: CopyIn, db: Session = Depends(get_db)):
    src = get_or_404(db, Wordbook, wordbook_id)
    wb = Wordbook(name=body.name.strip(), time_limit=src.time_limit,
                  words=[Word(english=w.english, meanings=w.meanings, position=w.position) for w in src.words])
    db.add(wb)
    db.commit()
    return wordbook_summary(wb, len(wb.words))


@app.post("/api/admin/wordbooks/{wordbook_id}/words", dependencies=admin)
def add_words(wordbook_id: int, body: WordsIn, db: Session = Depends(get_db)):
    wb = get_or_404(db, Wordbook, wordbook_id)
    start = max((w.position for w in wb.words), default=-1) + 1
    for i, w in enumerate(body.words):
        wb.words.append(Word(english=w.english.strip(), meanings=w.meanings.strip(), position=start + i))
    db.commit()
    return [word_out(w) for w in wb.words]


@app.patch("/api/admin/words/{word_id}", dependencies=admin)
def update_word(word_id: int, body: WordIn, db: Session = Depends(get_db)):
    w = get_or_404(db, Word, word_id)
    w.english, w.meanings = body.english.strip(), body.meanings.strip()
    db.commit()
    return word_out(w)


@app.delete("/api/admin/words/{word_id}", dependencies=admin)
def delete_word(word_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Word, word_id))
    db.commit()
    return {"ok": True}


@app.post("/api/admin/autofill", dependencies=admin)
def autofill(body: AutofillIn):
    try:
        return {"results": llm.fill_meanings([w.strip() for w in body.words if w.strip()])}
    except llm.LLMError as e:
        raise HTTPException(502, f"뜻 자동 채우기 실패: {e}")


@app.get("/api/admin/attempts", dependencies=admin)
def list_attempts(wordbook_id: int | None = None, db: Session = Depends(get_db)):
    q = select(Attempt).order_by(Attempt.finished_at.desc())
    if wordbook_id is not None:
        q = q.where(Attempt.wordbook_id == wordbook_id)
    return [attempt_summary(a) for a in db.scalars(q)]


@app.get("/api/admin/attempts/{attempt_id}", dependencies=admin)
def get_attempt(attempt_id: int, db: Session = Depends(get_db)):
    a = get_or_404(db, Attempt, attempt_id)
    return {**attempt_summary(a), "answers": [answer_out(x) for x in a.answers]}


@app.delete("/api/admin/attempts/{attempt_id}", dependencies=admin)
def delete_attempt(attempt_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Attempt, attempt_id))  # 문항별 답도 cascade로 함께 삭제
    db.commit()
    return {"ok": True}


@app.patch("/api/admin/answers/{answer_id}", dependencies=admin)
def correct_answer(answer_id: int, body: AnswerPatch, db: Session = Depends(get_db)):
    x = get_or_404(db, Answer, answer_id)
    x.is_correct, x.method, x.needs_review = body.is_correct, "manual", False
    x.attempt.correct_count = sum(y.is_correct for y in x.attempt.answers)
    db.commit()
    return {**attempt_summary(x.attempt), "answers": [answer_out(y) for y in x.attempt.answers]}
