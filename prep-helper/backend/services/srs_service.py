from datetime import datetime, timedelta
from backend.models.srs import SRSCard

def calculate_next_review(card: SRSCard, rating: str) -> SRSCard:
    """
    Calculates the next due date and spaced repetition parameters for an SRS card 
    based on the user rating (again, hard, good, easy) following SM-2 guidelines.
    """
    rating_lower = rating.lower().strip()
    
    # Ensure default starting values are populated
    if card.ease_factor is None:
        card.ease_factor = 2.5
    if card.repetitions is None:
        card.repetitions = 0
    if card.interval_days is None:
        card.interval_days = 0

    if rating_lower == "again":
        card.repetitions = 0
        card.interval_days = 1
    elif rating_lower == "hard":
        # repetitions remains unchanged
        card.ease_factor = max(1.3, card.ease_factor - 0.15)
        card.interval_days = max(1, round(card.interval_days * 1.2))
    elif rating_lower == "good":
        card.repetitions += 1
        if card.repetitions == 1:
            card.interval_days = 1
        elif card.repetitions == 2:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease_factor))
    elif rating_lower == "easy":
        card.repetitions += 1
        card.ease_factor = card.ease_factor + 0.15
        if card.repetitions == 1:
            card.interval_days = 1
        elif card.repetitions == 2:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease_factor * 1.3))
    else:
        # Fallback for unrecognized ratings
        card.interval_days = max(1, card.interval_days)

    now = datetime.utcnow()
    card.due_date = now + timedelta(days=card.interval_days)
    card.last_reviewed = now

    return card
