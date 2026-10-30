import os
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker
from sqlalchemy.pool import NullPool


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime | None) -> datetime | None:
    # SQLite는 tzinfo 없이 돌려주므로 UTC로 간주
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _db_url() -> str:
    url = os.environ.get("DATABASE_URL") or "sqlite:///./local.db"
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


_url = _db_url()
if _url.startswith("sqlite"):
    engine = create_engine(_url, connect_args={"check_same_thread": False})
else:
    # 서버리스: 요청마다 연결을 맺고 닫는다 (Neon 쪽 풀러 사용)
    engine = create_engine(_url, poolclass=NullPool)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Wordbook(Base):
    __tablename__ = "wordbooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    time_limit: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    words: Mapped[list["Word"]] = relationship(
        back_populates="wordbook", cascade="all, delete-orphan", order_by="Word.position"
    )


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    wordbook_id: Mapped[int] = mapped_column(ForeignKey("wordbooks.id", ondelete="CASCADE"), index=True)
    english: Mapped[str] = mapped_column(String(100))
    meanings: Mapped[str] = mapped_column(Text)  # 쉼표로 구분한 복수 정답
    position: Mapped[int] = mapped_column(Integer, default=0)

    wordbook: Mapped[Wordbook] = relationship(back_populates="words")


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    wordbook_id: Mapped[int | None] = mapped_column(
        ForeignKey("wordbooks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    wordbook_name: Mapped[str] = mapped_column(String(100))  # 단어장이 삭제돼도 기록 유지
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)

    answers: Mapped[list["Answer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", order_by="Answer.position"
    )


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("attempts.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    english: Mapped[str] = mapped_column(String(100))
    meanings: Mapped[str] = mapped_column(Text)
    user_answer: Mapped[str] = mapped_column(Text, default="")
    dont_know: Mapped[bool] = mapped_column(Boolean, default=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    method: Mapped[str] = mapped_column(String(10), default="rule")  # rule | llm | manual
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    left_tab: Mapped[bool] = mapped_column(Boolean, default=False)

    attempt: Mapped[Attempt] = relationship(back_populates="answers")


class LoginFailure(Base):
    __tablename__ = "login_failures"

    ip: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
