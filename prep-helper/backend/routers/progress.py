from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import is_vault_configured
from backend.models.document import Document
from backend.models.question import Question
from backend.models.srs import SRSCard
from backend.models.tag import Tag, ItemTag
from backend.services.progress_service import (
    get_study_streak,
    get_heatmap_data,
    get_topic_coverage,
    get_weak_areas
)

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/dashboard")
async def get_dashboard_analytics(db: AsyncSession = Depends(get_db)):
    """Fetches comprehensive progress tracking metrics for the main Dashboard."""
    if not is_vault_configured():
        return {
            "streak": 0,
            "heatmap": [],
            "topic_coverage": [],
            "weak_areas": [],
            "stats": {
                "total_documents": 0,
                "total_questions": 0,
                "due_today": 0
            }
        }

    try:
        streak = await get_study_streak(db)
        heatmap = await get_heatmap_data(db)
        topic_coverage = await get_topic_coverage(db)
        weak_areas = await get_weak_areas(db, limit=5)

        # Extra general metrics
        doc_count_res = await db.execute(select(func.count(Document.id)))
        total_documents = doc_count_res.scalar() or 0

        q_count_res = await db.execute(select(func.count(Question.id)))
        total_questions = q_count_res.scalar() or 0

        now = datetime.utcnow()
        due_res = await db.execute(select(func.count(SRSCard.id)).where(SRSCard.due_date <= now))
        due_today = due_res.scalar() or 0

        return {
            "streak": streak,
            "heatmap": heatmap,
            "topic_coverage": topic_coverage,
            "weak_areas": weak_areas,
            "stats": {
                "total_documents": total_documents,
                "total_questions": total_questions,
                "due_today": due_today
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard metrics: {str(e)}")


@router.get("/topic/{tag_name}")
async def get_topic_detailed_analytics(tag_name: str, db: AsyncSession = Depends(get_db)):
    """Fetches detailed progress metrics for a specific concept tag."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    # Find the tag
    t_stmt = select(Tag).where(Tag.name == tag_name)
    t_res = await db.execute(t_stmt)
    tag = t_res.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Topic tag not found.")

    # Calculate metrics specific to this tag
    # Questions count
    q_count_stmt = (
        select(func.count(Question.id))
        .join(ItemTag, ItemTag.item_id == Question.id)
        .where(ItemTag.item_type == "question", ItemTag.tag_id == tag.id)
    )
    q_count_res = await db.execute(q_count_stmt)
    total_questions = q_count_res.scalar() or 0

    if total_questions == 0:
        return {
            "tag_name": tag_name,
            "total_questions": 0,
            "reviewed_once": 0,
            "mastered": 0,
            "avg_ease": 2.5
        }

    # Reviewed Once Count
    rev_count_stmt = (
        select(func.count(Question.id))
        .join(ItemTag, ItemTag.item_id == Question.id)
        .join(SRSCard, Question.id == SRSCard.question_id)
        .where(
            ItemTag.item_type == "question", 
            ItemTag.tag_id == tag.id,
            SRSCard.repetitions > 0
        )
    )
    rev_res = await db.execute(rev_count_stmt)
    reviewed_once = rev_res.scalar() or 0

    # Mastered Count
    mast_count_stmt = (
        select(func.count(Question.id))
        .join(ItemTag, ItemTag.item_id == Question.id)
        .join(SRSCard, Question.id == SRSCard.question_id)
        .where(
            ItemTag.item_type == "question", 
            ItemTag.tag_id == tag.id,
            SRSCard.interval_days >= 21
        )
    )
    mast_res = await db.execute(mast_count_stmt)
    mastered = mast_res.scalar() or 0

    # Average Ease Factor
    avg_ease_stmt = (
        select(func.avg(SRSCard.ease_factor))
        .select_from(Question)
        .join(ItemTag, ItemTag.item_id == Question.id)
        .join(SRSCard, Question.id == SRSCard.question_id)
        .where(
            ItemTag.item_type == "question", 
            ItemTag.tag_id == tag.id
        )
    )
    ease_res = await db.execute(avg_ease_stmt)
    avg_ease = float(round(ease_res.scalar() or 2.5, 2))

    return {
        "tag_name": tag_name,
        "total_questions": total_questions,
        "reviewed_once": reviewed_once,
        "mastered": mastered,
        "avg_ease": avg_ease
    }
