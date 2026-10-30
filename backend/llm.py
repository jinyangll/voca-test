import json
import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# 서버리스 1회 처리 10초 제한 안에 끝나도록 (NF-18)
TIMEOUT_SECONDS = 7.0


class LLMError(Exception):
    pass


def _chat_json(system: str, user: str) -> dict:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise LLMError("GROQ_API_KEY가 설정되지 않았습니다")
    try:
        resp = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            timeout=TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise LLMError(str(e)) from e


JUDGE_SYSTEM = """너는 초등학생 영어 단어 시험 채점자다.
각 문항의 영어 단어, 등록된 정답 뜻(쉼표로 구분, 하나만 맞아도 됨), 학생 답을 보고 학생 답이 정답 뜻 중 하나와 같은 의미인지 판정한다.

판정 기준:
- 품사나 어미·활용형만 다르고 같은 뜻이면 정답 (예: 아름다운 / 아름답다, 달리기 / 달리다)
- 한글 오타 1글자 정도는 정답
- 영어 단어의 다른 올바른 뜻이라도 등록된 정답 뜻과 의미가 다르면 오답
- 비슷해 보이지만 의미가 다른 단어는 오답 (예: 빠르다 / 이른)
- 너무 넓거나 막연한 답은 오답

반드시 다음 JSON 형식으로만 답한다:
{"results": [{"id": 문항id, "correct": true 또는 false, "reason": "짧은 한국어 판정 이유"}]}"""


def judge(items: list[dict]) -> dict[int, tuple[bool, str]]:
    """items: [{id, english, meanings, answer}] -> {id: (정답 여부, 이유)}"""
    if not items:
        return {}
    data = _chat_json(JUDGE_SYSTEM, json.dumps({"items": items}, ensure_ascii=False))
    out: dict[int, tuple[bool, str]] = {}
    for r in data.get("results", []):
        try:
            out[int(r["id"])] = (bool(r["correct"]), str(r.get("reason", "")))
        except (KeyError, TypeError, ValueError):
            continue
    return out


FILL_SYSTEM = """너는 초등학생용 영어 단어장을 만드는 선생님이다.
주어진 영어 단어마다 초등학생이 외우기 좋은 대표 한국어 뜻을 1~3개 쓴다. 여러 뜻은 ", "로 구분한다.
반드시 다음 JSON 형식으로만 답한다:
{"results": [{"english": "단어", "meanings": "뜻1, 뜻2"}]}"""


def fill_meanings(words: list[str]) -> dict[str, str]:
    if not words:
        return {}
    data = _chat_json(FILL_SYSTEM, json.dumps({"words": words}, ensure_ascii=False))
    return {
        str(r["english"]): str(r["meanings"])
        for r in data.get("results", [])
        if isinstance(r, dict) and "english" in r and "meanings" in r
    }
