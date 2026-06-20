from datetime import datetime, timedelta
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.tag import Tag, ItemTag
from backend.models.question import Question
from backend.models.srs import SRSCard, SRSReview

async def get_study_streak(db: AsyncSession) -> int:
    """
    Calculates the user's consecutive day study streak in UTC.
    Checks reviews from today or yesterday, moving backward day-by-day.
    """
    # 1. Fetch all distinct UTC dates of reviews in descending order
    stmt = (
        select(func.strftime("%Y-%m-%d", SRSReview.reviewed_at).label("review_date"))
        .distinct()
        .order_by(func.strftime("%Y-%m-%d", SRSReview.reviewed_at).desc())
    )
    res = await db.execute(stmt)
    review_dates = {row.review_date for row in res.all() if row.review_date}

    if not review_dates:
        return 0

    today = datetime.utcnow().date()
    today_str = today.strftime("%Y-%m-%d")
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    # If the user has studied neither today nor yesterday, the active streak is 0
    if today_str not in review_dates and yesterday_str not in review_dates:
        return 0

    # Determine start date of calculations
    current_date = today if today_str in review_dates else (today - timedelta(days=1))
    streak = 0

    while True:
        current_str = current_date.strftime("%Y-%m-%d")
        if current_str in review_dates:
            streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    return streak


async def get_heatmap_data(db: AsyncSession, days=365) -> list[dict]:
    """
    Aggregates study reviews count grouped by date for the last N days.
    """
    threshold_date = datetime.utcnow() - timedelta(days=days)
    
    stmt = (
        select(
            func.strftime("%Y-%m-%d", SRSReview.reviewed_at).label("date"),
            func.count(SRSReview.id).label("count")
        )
        .where(SRSReview.reviewed_at >= threshold_date)
        .group_by("date")
        .order_by("date")
    )
    res = await db.execute(stmt)
    return [{"date": row.date, "count": row.count} for row in res.all() if row.date]


async def get_topic_coverage(db: AsyncSession) -> list[dict]:
    """
    Calculates progress metrics (total questions, reviewed count, mastered count) 
    per concept tag.
    """
    stmt = (
        select(
            Tag.name.label("tag_name"),
            func.count(Question.id).label("total_questions"),
            func.sum(case((SRSCard.repetitions > 0, 1), else_=0)).label("reviewed_once"),
            func.sum(case((SRSCard.interval_days >= 21, 1), else_=0)).label("mastered")
        )
        .join(ItemTag, ItemTag.tag_id == Tag.id)
        .join(Question, (ItemTag.item_id == Question.id) & (ItemTag.item_type == "question"))
        .outerjoin(SRSCard, Question.id == SRSCard.question_id)
        .group_by(Tag.name)
        .order_by(func.count(Question.id).desc())
    )
    res = await db.execute(stmt)
    
    output = []
    for row in res.all():
        output.append({
            "tag_name": row.tag_name,
            "total_questions": row.total_questions,
            "reviewed_once": int(row.reviewed_once or 0),
            "mastered": int(row.mastered or 0)
        })
    return output


async def get_weak_areas(db: AsyncSession, limit=5) -> list[dict]:
    """
    Identifies the top N tag concepts with the lowest average ease factor.
    """
    stmt = (
        select(
            Tag.name.label("tag_name"),
            func.avg(SRSCard.ease_factor).label("avg_ease"),
            func.count(Question.id).label("question_count")
        )
        .join(ItemTag, ItemTag.tag_id == Tag.id)
        .join(Question, (ItemTag.item_id == Question.id) & (ItemTag.item_type == "question"))
        .join(SRSCard, Question.id == SRSCard.question_id)
        .group_by(Tag.name)
        .order_by(func.avg(SRSCard.ease_factor).asc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    
    output = []
    for row in res.all():
        output.append({
            "tag_name": row.tag_name,
            "avg_ease": float(round(row.avg_ease or 0.0, 2)),
            "question_count": row.question_count
        })
    return output
