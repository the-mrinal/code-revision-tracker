"""SM-2 spaced repetition algorithm implementation."""

from datetime import date, timedelta


def sm2(self_rating: int, easiness_factor: float, interval: int, repetitions: int) -> dict:
    """
    Apply the SM-2 algorithm given a self-rating (1-5).

    Returns dict with updated easiness_factor, interval, repetitions, and next_review date.
    """
    # Map self_rating (1-5) to SM-2 quality (0-5)
    quality_map = {1: 0, 2: 1, 3: 3, 4: 4, 5: 5}
    quality = quality_map.get(self_rating, 0)

    # Update easiness factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality < 3:
        # Failed review — reset
        new_interval = 1
        new_repetitions = 0
    else:
        new_repetitions = repetitions + 1
        if new_repetitions == 1:
            new_interval = 1
        elif new_repetitions == 2:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)

    next_review = date.today() + timedelta(days=new_interval)

    return {
        "easiness_factor": round(new_ef, 2),
        "interval": new_interval,
        "repetitions": new_repetitions,
        "next_review": next_review.isoformat(),
    }
