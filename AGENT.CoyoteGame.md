# Coyote Game - Purpose and Product Intent

## Purpose

Coyote Game is a very small MVP built to test a specific delight hypothesis for Make The World:

> A player can progressively alter a world, watch the system form a confident theory of their intent, and then feel delight when the system plays out that plan in a way that feels coherent, surprising, and meaningfully responsive to what they were trying to do.

This is not a general game prototype. It is a focused probe of whether system-carried delight exists at all.

## Getting Started

- Read this file first for product intent and tone constraints.
- Then follow `AGENT.CoyoteGame.implementation.md` under **Getting Started** for code-level orientation.

## MVP Frame

The player is Wile E. Coyote trying to catch the Road Runner.

The strong existing IP frame is intentional:
- it immediately answers "What do I do?"
- it immediately answers "Why do I care?"
- it licenses absurd, risky, cartoon logic
- it supports plans that can briefly work, then rebound poetically on the Coyote

## Core Player Loop

1. The player moves between a small number of rooms or places.
   - e.g. road under cliff, cliff top near boulder
2. In a place, the player can:
   - navigate
   - order an Acme object into the current place
   - wait for the Road Runner
3. After each object order, the system updates a Hypothesis.
   - "It looks like you're trying to ..."
   - this hypothesis should be confident, coherent, and grounded in the currently staged objects and their room locations
   - it should assume the player has an intelligent, possibly insane plan
4. When the player chooses `wait`, the system:
   - treats the currently staged setup as a committed plan
   - plays out the outcome in a single coherent response
   - then clears staged objects for the next attempt
5. The system may remember a short summary of prior attempts so it can notice and reflect iterative changes in plan across runs.

## MVP World Model

This MVP intentionally uses a very lightweight local framework.

Needed state:
- rooms
- player location
- room-local object lists (temporary local framework only; objects are not first-class system entities)
- short memory of prior attempts

Not needed for this MVP:
- first-class object system
- manipulation of existing objects
- explicit positioning graph
- multi-step execution during plan resolution
- persistent post-resolution world state

## Delight Hypothesis Being Tested

The delight hypothesis is:

> Players will feel a meaningful "oh wow" moment if the system appears to understand what they are trying to do, updates that understanding as they stage more elements, and then resolves the attempt in a way that feels like a satisfying cartoon expression of their plan.

Important sub-hypotheses:
- players may move fluidly between chaos mode ("what will it make of this?") and planning mode ("I am trying to do X")
- players may enjoy discovering that the system remembers and reacts to previous attempts
- players do not need to "win"; they mainly crave the validation of "my plan worked", even briefly, before reversal restores the loop

## Tone and Interpretation Requirements

Hypothesis generation should:
- be confident
- assume intelligence and intentionality in the player's setup
- avoid explicitly foreshadowing likely failure
- prefer interpretations whose setups could naturally rebound on the Coyote in execution

Execution should:
- honor the staged plan
- feel causally grounded in the established objects and places
- allow brief or local success
- often resolve in a poetic reversal that returns the game to the chase loop

## MVP Success Condition

This MVP is successful if players show signs that the core loop itself is delightful, for example:
- immediate desire to try again
- iterative refinement of similar plans
- delight at the system's evolving hypothesis
- surprise that the system remembered prior attempts
- social retelling ("wait, you can do that?")

This MVP does not need to prove:
- scalability
- broad game depth
- durable progression
- full systemic simulation
- community play

