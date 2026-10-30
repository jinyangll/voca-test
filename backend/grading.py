import re

from . import llm

# \W는 유니코드 기준이라 한글은 남기고 공백·문장부호만 지운다
_STRIP = re.compile(r"[\W_]+")


def normalize(text: str) -> str:
    return _STRIP.sub("", text).lower()


def split_meanings(meanings: str) -> list[str]:
    return [m.strip() for m in re.split(r"[,，]", meanings) if m.strip()]


def rule_match(answer: str, meanings: str) -> bool:
    n = normalize(answer)
    return bool(n) and any(n == normalize(m) for m in split_meanings(meanings))


def grade(items: list[dict]) -> list[dict]:
    """items: [{english, meanings, answer, dont_know}]
    각 항목에 is_correct, method, needs_review, reason을 채워 돌려준다."""
    pending = []
    for i, it in enumerate(items):
        it.update(is_correct=False, method="rule", needs_review=False, reason="")
        if it["dont_know"]:
            it["reason"] = "모르겠어요"
        elif not normalize(it["answer"]):
            it["reason"] = "빈 답"
        elif rule_match(it["answer"], it["meanings"]):
            it["is_correct"] = True
            it["reason"] = "등록된 뜻과 일치"
        else:
            pending.append(i)

    if pending:
        try:
            verdicts = llm.judge([
                {"id": i, "english": items[i]["english"], "meanings": items[i]["meanings"],
                 "answer": items[i]["answer"]}
                for i in pending
            ])
        except llm.LLMError:
            verdicts = {}
        for i in pending:
            if i in verdicts:
                items[i]["is_correct"], items[i]["reason"] = verdicts[i]
                items[i]["method"] = "llm"
            else:
                # F-18: LLM 실패 시 1차 결과(오답)로 두고 확인 필요 표시
                items[i]["needs_review"] = True
                items[i]["reason"] = "LLM 채점 실패 - 확인 필요"
    return items
