# 영어 단어 시험

과외 학생용 영어 단어 뜻 맞추기 시험 사이트. 요구사항은 `영어 단어 시험 사이트 요구사항 명세서.md` 참고.

- 프론트: React + Vite (`src/`)
- 백엔드: FastAPI (`backend/`), Vercel 함수 진입점 `api/index.py`
- DB: 로컬은 SQLite(`local.db`), 배포는 Neon PostgreSQL
- 채점: 규칙 일치 → 불일치만 Groq LLM 일괄 판정 → 실패 시 '확인 필요'

## 로컬 실행

```bash
# 백엔드
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export ADMIN_PASSWORD=비밀번호 JWT_SECRET=아무-긴-문자열 GROQ_API_KEY=gsk_...
uvicorn backend.main:app --port 8000

# 프론트 (다른 터미널)
npm install
npm run dev   # http://localhost:5173, /api는 8000으로 프록시
```

테스트: `pytest tests`

## Vercel 배포

1. GitHub에 올린 뒤 Vercel에서 Import (Framework: Vite 자동 인식)
2. Vercel Marketplace에서 Neon을 연결하면 `DATABASE_URL`이 자동 등록됨
3. Environment Variables에 `ADMIN_PASSWORD`, `JWT_SECRET`, `GROQ_API_KEY` 추가 (`.env.example` 참고)
4. 배포. 테이블은 첫 요청 때 자동 생성됨

## 구현 범위

명세서 우선순위 상·중 전부 구현. 하(F-20 오답 다시 풀기, F-24 한→영 모드)는 미구현.
