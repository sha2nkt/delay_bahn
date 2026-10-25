"""When a change between two trains is too tight to rely on."""
from app import delays

# minutes of slack that must remain after the median delay for a transfer to count as safe
TRANSFER_TOLERANCE_MIN = 2
# median delay exceeding the transfer time by more than this makes the transfer unlikely
UNLIKELY_EXCESS_MIN = 30


def walk_minutes(legs: list[dict], a: int, b: int) -> float:
    """Total walking time between train legs a and b."""
    return sum(
        (
            delays.to_berlin_naive(w["plannedArrival"])
            - delays.to_berlin_naive(w["plannedDeparture"])
        ).total_seconds() / 60
        for w in legs[a + 1 : b]
        if w["plannedArrival"] and w["plannedDeparture"]
    )


def transfer_pairs(legs: list[dict]):
    """Yield (arriving_leg_idx, departing_leg_idx, planned_min, live_min) for each
    train-to-train transfer; walking legs in between eat into the buffer. live_min
    is the slack on bahn.de's live (echtzeit) times, None when neither train deviates
    from the schedule: on today's connections bahn.de plans with them, and a transfer
    that looks impossible on paper can be fine because the next train is itself delayed."""
    train_idx = [i for i, leg in enumerate(legs) if not leg["walking"]]
    for a, b in zip(train_idx, train_idx[1:]):
        prev, nxt = legs[a], legs[b]
        if not prev["plannedArrival"] or not nxt["plannedDeparture"]:
            continue
        walk = walk_minutes(legs, a, b)

        def gap(dep: str, arr: str) -> float:
            return (delays.to_berlin_naive(dep) - delays.to_berlin_naive(arr)).total_seconds() / 60 - walk

        planned = gap(nxt["plannedDeparture"], prev["plannedArrival"])
        live = None
        if prev.get("arrival") or nxt.get("departure"):
            live = gap(nxt.get("departure") or nxt["plannedDeparture"], prev.get("arrival") or prev["plannedArrival"])
        yield a, b, planned, live


def transfer_margin(planned_min: float, live_min: float | None, median_delay: float) -> float:
    """Minutes left to change trains. A live time already holds today's delay, so it
    is not discounted by the typical one a second time; on paper the arriving
    train's median delay stands in for it."""
    return live_min if live_min is not None else planned_min - median_delay


def tight_transfers(legs: list[dict]) -> list[dict]:
    """Transfers that leave <= TRANSFER_TOLERANCE_MIN minutes: on live times where
    bahn.de has them, else after the arriving leg's median delay."""
    out = []
    for a, b, planned_min, live_min in transfer_pairs(legs):
        stats = legs[a].get("delayStats")
        if not stats or stats["medianDelay"] is None:
            continue
        if transfer_margin(planned_min, live_min, stats["medianDelay"]) > TRANSFER_TOLERANCE_MIN:
            continue
        tt = {
            "station": legs[a]["destination"]["name"],
            "legIndex": a,  # index of the arriving leg in `legs`
            "depLegIndex": b,  # index of the departing leg that would be missed
            "transferMinutes": round(planned_min),
            "medianDelay": stats["medianDelay"],
        }
        if live_min is None:
            tt["unlikely"] = stats["medianDelay"] - planned_min > UNLIKELY_EXCESS_MIN
        else:
            arrival = legs[a].get("arrival") or legs[a]["plannedArrival"]
            tt.update({
                "unlikely": live_min < 0,
                "liveMinutes": round(live_min),
                "liveDelay": round((delays.to_berlin_naive(arrival)
                                    - delays.to_berlin_naive(legs[a]["plannedArrival"])).total_seconds() / 60),
            })
        out.append(tt)
    return out
