# Lazy catch-up instead of a tick loop

The server never advances game state in the background. Every request that touches a Player first runs `advance(player, now)`, which replays every queue boundary since the last update in time order and integrates resources in closed form between boundaries. The whole request (load → advance → validate → apply → save) runs synchronously in one `BEGIN IMMEDIATE` transaction with no `await` inside, so requests are strictly serial and concurrent tabs cannot race.

We chose this over a tick loop because Players don't interact, so nothing needs a Planet to be current except its owner's own requests. A tick loop would only be accurate to within one tick, and it would spend CPU on offline Players. `advance` takes its boundaries from a pluggable event source, so future fleet arrivals, or a background job that keeps Planets current for highscores, can reuse it without replacing the model.

## Consequences

- Durations are fixed when an item starts, so every running item has a stable `endsAt`.
- Read-only requests write too: they persist their catch-up.
- The single-process, synchronous design depends on `node:sqlite` being synchronous. Moving to an async driver or several processes would need explicit locking.
