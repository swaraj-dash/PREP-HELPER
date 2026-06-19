import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import is_vault_configured
from backend.models.question import Question
from backend.models.srs import SRSCard, SRSReview, StudySession
from backend.models.tag import Tag, ItemTag
from backend.schemas.srs import (
    SRSStateOut, 
    ReviewSubmit, 
    SessionStart, 
    SessionStartResponse, 
    SessionEndResponse
)
from backend.schemas.question import QuestionOut
from backend.schemas.tag import TagOut
from backend.services.srs_service import calculate_next_review

router = APIRouter(prefix="/srs", tags=["srs"])

@router.get("/due", response_model=list[QuestionOut])
async def get_due_questions(
    tags: list[str] = Query(None, alias="tags"),
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db)
):
    """Fetches due flashcard questions based on due date <= now and tag AND filters."""
    if not is_vault_configured():
        return []

    now = datetime.utcnow()
    stmt = select(Question).join(SRSCard, Question.id == SRSCard.question_id).where(SRSCard.due_date <= now)

    # Apply tag AND intersection if filter is present
    if tags:
        subq = (
            select(ItemTag.item_id)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "question", Tag.name.in_(tags))
            .group_by(ItemTag.item_id)
            .having(func.count(func.distinct(Tag.name)) == len(tags))
        )
        stmt = stmt.where(Question.id.in_(subq))

    stmt = stmt.order_by(SRSCard.due_date.asc()).limit(limit)
    res = await db.execute(stmt)
    questions = res.scalars().all()

    if not questions:
        return []

    q_ids = [q.id for q in questions]

    # Batch load tags
    tag_map = {}
    tags_stmt = (
        select(ItemTag.item_id, Tag)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "question", ItemTag.item_id.in_(q_ids))
    )
    tags_res = await db.execute(tags_stmt)
    for q_id, tag in tags_res.all():
        if q_id not in tag_map:
            tag_map[q_id] = []
        tag_map[q_id].append(TagOut.model_validate(tag))

    # Batch load SRS card details
    srs_map = {}
    srs_stmt = select(SRSCard).where(SRSCard.question_id.in_(q_ids))
    srs_res = await db.execute(srs_stmt)
    for card in srs_res.scalars().all():
        srs_map[card.question_id] = SRSStateOut.model_validate(card)

    # Map to schemas
    data_out = []
    for q in questions:
        data_out.append(
            QuestionOut(
                id=q.id,
                document_id=q.document_id,
                question_text=q.question_text,
                answer_text=q.answer_text,
                difficulty=q.difficulty,
                source_page=q.source_page,
                order_in_doc=q.order_in_doc,
                bookmarked=q.bookmarked,
                created_at=q.created_at,
                updated_at=q.updated_at,
                tags=tag_map.get(q.id, []),
                srs_state=srs_map.get(q.id)
            )
        )
    return data_out


@router.post("/review", response_model=SRSStateOut)
async def submit_card_review(payload: ReviewSubmit, db: AsyncSession = Depends(get_db)):
    """Logs a card review result, recalculates spacing schedule, and returns updated card state."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    # 1. Fetch card or create one if missing
    card_stmt = select(SRSCard).where(SRSCard.question_id == payload.question_id)
    card_res = await db.execute(card_stmt)
    card = card_res.scalar_one_or_none()

    if not card:
        # Create card on the fly if missing (e.g. legacy data or custom card setup)
        # Verify question exists
        q_stmt = select(Question).where(Question.id == payload.question_id)
        q_res = await db.execute(q_stmt)
        if not q_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Question not found.")

        card = SRSCard(
            question_id=payload.question_id,
            ease_factor=2.5,
            interval_days=0,
            due_date=datetime.utcnow(),
            repetitions=0
        )
        db.add(card)
        await db.flush()

    # 2. Update spacing parameters via SM-2 service helper
    calculate_next_review(card, payload.rating)

    # 3. Log review record
    review = SRSReview(
        card_id=card.id,
        rating=payload.rating,
        response_time_ms=payload.response_time_ms
    )
    db.add(review)

    await db.commit()
    await db.refresh(card)

    return SRSStateOut.model_validate(card)


@router.get("/stats")
async def get_srs_stats(db: AsyncSession = Depends(get_db)):
    """Computes total, due, learning, new, and mastered count stats across all vault flashcards."""
    if not is_vault_configured():
        return {
            "total_cards": 0,
            "due_today": 0,
            "mastered": 0,
            "learning": 0,
            "new": 0
        }

    now = datetime.utcnow()

    # Total Cards
    total_res = await db.execute(select(func.count(SRSCard.id)))
    total_cards = total_res.scalar() or 0

    # Due Today
    due_res = await db.execute(select(func.count(SRSCard.id)).where(SRSCard.due_date <= now))
    due_today = due_res.scalar() or 0

    # Mastered (interval >= 21 days)
    mastered_res = await db.execute(select(func.count(SRSCard.id)).where(SRSCard.interval_days >= 21))
    mastered = mastered_res.scalar() or 0

    # Learning (repetitions > 0 and interval < 21)
    learning_res = await db.execute(
        select(func.count(SRSCard.id)).where(SRSCard.repetitions > 0, SRSCard.interval_days < 21)
    )
    learning = learning_res.scalar() or 0

    # New (repetitions == 0)
    new_res = await db.execute(select(func.count(SRSCard.id)).where(SRSCard.repetitions == 0))
    new = new_res.scalar() or 0

    return {
        "total_cards": total_cards,
        "due_today": due_today,
        "mastered": mastered,
        "learning": learning,
        "new": new
    }


@router.post("/session/start", response_model=SessionStartResponse)
async def start_study_session(payload: SessionStart, db: AsyncSession = Depends(get_db)):
    """Logs start of study session, registers active tag filters, and returns first due question card."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    # Create StudySession log row
    session = StudySession(
        tag_filter=json.dumps(payload.tag_filter) if payload.tag_filter else None,
        session_type=payload.session_type or "flashcard",
        cards_reviewed=0,
        started_at=datetime.utcnow()
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Fetch first card matching query filter
    now = datetime.utcnow()
    card_stmt = select(Question).join(SRSCard, Question.id == SRSCard.question_id).where(SRSCard.due_date <= now)

    if payload.tag_filter:
        subq = (
            select(ItemTag.item_id)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "question", Tag.name.in_(payload.tag_filter))
            .group_by(ItemTag.item_id)
            .having(func.count(func.distinct(Tag.name)) == len(payload.tag_filter))
        )
        card_stmt = card_stmt.where(Question.id.in_(subq))

    card_stmt = card_stmt.order_by(SRSCard.due_date.asc()).limit(1)
    card_res = await db.execute(card_stmt)
    first_q = card_res.scalar_one_or_none()

    first_card_out = None
    if first_q:
        # Load tags
        tag_stmt = (
            select(Tag)
            .join(ItemTag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "question", ItemTag.item_id == first_q.id)
        )
        t_res = await db.execute(tag_stmt)
        tags = [TagOut.model_validate(t) for t in t_res.scalars().all()]

        # Load SRS Card
        srs_stmt = select(SRSCard).where(SRSCard.question_id == first_q.id)
        s_res = await db.execute(srs_stmt)
        card_obj = s_res.scalar_one_or_none()
        srs_state = SRSStateOut.model_validate(card_obj) if card_obj else None

        first_card_out = QuestionOut(
            id=first_q.id,
            document_id=first_q.document_id,
            question_text=first_q.question_text,
            answer_text=first_q.answer_text,
            difficulty=first_q.difficulty,
            source_page=first_q.source_page,
            order_in_doc=first_q.order_in_doc,
            bookmarked=first_q.bookmarked,
            created_at=first_q.created_at,
            updated_at=first_q.updated_at,
            tags=tags,
            srs_state=srs_state
        )

    return SessionStartResponse(
        session_id=session.id,
        first_card=first_card_out
    )


@router.post("/session/{id}/end", response_model=SessionEndResponse)
async def end_study_session(id: str, cards_reviewed: int = Query(0), db: AsyncSession = Depends(get_db)):
    """Logs end timestamp and total reviewed card count for study session log."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(StudySession).where(StudySession.id == id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found.")

    session.ended_at = datetime.utcnow()
    session.cards_reviewed = cards_reviewed
    await db.commit()
    await db.refresh(session)

    return SessionEndResponse(
        session_id=session.id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        cards_reviewed=session.cards_reviewed,
        session_type=session.session_type
    )
