/**
 * Deterministic messageOrchestration slot id for a look bundle (Phase 7). Every look declares
 * exactly one describe slot in its own one-slot bundle, so a single constant (not a per-room/
 * per-component derivation, unlike navigateBundleSlotIds.ts's leave slots) is sufficient.
 *
 * Declare and register both happen in
 * dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts, in the same
 * function call --- unlike navigate's leave/header/arrive, a look's bundle has no sibling slot
 * resolved by a separate component, so there is no cross-invocation correlation id to thread
 * through the `Look Command Requested` payload (an earlier version of this code did that
 * regardless, copying navigate's shape without re-deriving whether the reason for it applied
 * here; it didn't, and was simplified back out). If a future change ever produces more than one
 * describe step per bundle (Phase 9's presentation-kernel capstone, if it goes that direction),
 * this constant stops being sufficient and declaration would need to move back upstream to
 * wherever the full ordered step list is first known --- design that then, against a real
 * requirement, not speculatively now.
 */
export const LOOK_DESCRIBE_SLOT_ID = 'describe'
