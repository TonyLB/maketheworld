import type { MembershipManipulationFrame } from '../membershipFrame'
import type { ManipulationFrame } from '../manipulationFrame'
import { normalizeRelationSpan } from '../normalizeRelationSpan'

import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    type PlanStep,
} from './planStep'

export type CompileUngroundedPlanResult =
    | { type: 'success'; steps: PlanStep[] }
    | { type: 'nestingDefer' }
    | { type: 'multiObject' }

/**
 * Plan-stage compiler (zero KR access): maps a shipped, already-extracted
 * membership frame into ungrounded steps. Does not emit Assertion steps ---
 * `MembershipManipulationFrame` carries no location-disambiguating span
 * (e.g. "from table") to build one from yet (see BD-14 / C1 checklist).
 */
export function compileMembershipUngroundedPlan(
    frame: MembershipManipulationFrame
): CompileUngroundedPlanResult {
    if (frame.rawObjectSpans.length !== 1) {
        return { type: 'multiObject' }
    }
    const object = objectSpanRef(frame.rawObjectSpans[0])

    const change = frame.verbClass === 'acquire'
        ? {
            kind: 'change' as const,
            primitive: 'transferMembership' as const,
            object,
            from: currentHostRef(object),
            to: actingCharacterRef,
        }
        : {
            kind: 'change' as const,
            primitive: 'transferMembership' as const,
            object,
            from: actingCharacterRef,
            to: currentHostRef(actingCharacterRef),
        }

    return { type: 'success', steps: [change] }
}

/**
 * Plan-stage compiler (zero KR access): maps a shipped, already-extracted
 * relational frame into ungrounded steps. Reuses the already-deterministic,
 * already-KR-free `normalizeRelationSpan` (B2) rather than reimplementing
 * phrase-to-enum mapping. A relational `Change` carries no `host` (see
 * `synthesize/AGENT.implementation.md`, "Relational edges"): where the relation
 * lives is Expansion's question, not Plan's. `frame.characterId` / `frame.hostRoomId`
 * are deliberately not read, even though upstream has already populated
 * them --- Plan's job is span/verb reasoning only, regardless of what
 * happens to already be grounded.
 *
 * BD-15/16 originally prepended a `sameHost` `Assertion` before every `Change`
 * step here, unconditionally. **That was dropped, 2026-09-01**, along with
 * `SameHostAssertion`/`Assertion`'s `sameHost` member entirely
 * (`planStep.ts`): this function has no live caller (the live
 * ingress route, `compileAttemptsFromSkeleton.ts`, never reaches this
 * scaffold), so there was nothing left to keep the ungrounded shape in
 * sync for.
 */
export function compileRelationalUngroundedPlan(
    frame: ManipulationFrame
): CompileUngroundedPlanResult {
    const norm = normalizeRelationSpan(frame.relationSpan)
    if (norm.type === 'nestingDefer') {
        return { type: 'nestingDefer' }
    }

    const relation = norm.relation
    const subject = objectSpanRef(frame.subjectSpan)
    const target = objectSpanRef(frame.targetSpan)

    const change = {
        kind: 'change' as const,
        primitive: frame.operationKind,
        subject,
        target,
        ...(relation.type === 'custom'
            ? { relationKind: 'Custom' as const, relationLabel: relation.relationLabel }
            : { relationKind: relation.kind }),
    }

    return { type: 'success', steps: [change] }
}
