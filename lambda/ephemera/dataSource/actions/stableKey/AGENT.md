# `mtw.ephemera.actions/stableKey`

## Role

`actions/stableKey/` holds the current Coyote/Acme stable-key helpers used by actions parsing and publish flow:

- occupancy collection across Coyote rooms
- deterministic stable-key finalization and collision repair

## Current posture

The implementation here is intentionally pragmatic and domain-coupled:

- tied to Coyote room/object occupancy in ephemera cache
- tied to Acme order post-enrich finalize semantics
- tied to current reserved/remap rules used in actions flow

## Deferred design note

There is likely a broader, more general stable-key policy abstraction mixed into these helpers (especially prompt-facing semantic key construction vs domain finalize policy). We are explicitly deferring that disentangling work for now.

Until that follow-up lands, keep these utilities colocated with actions and treat this directory as the stable-key contract boundary for `mtw.ephemera.actions`.
