import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { IdentityPlanCandidate, RelationalIdentityPlanCandidate } from '../identityPlanCandidate'
import type { DissolveRelationStep, EstablishRelationStep, TransferMembershipStep } from '../parsePlanStep'
import type { NormalizedRelation } from '../relationKind'
import type { SandboxPlanStep } from '../sandboxPlan'

export type ToSandboxPlanStepResult =
    | { ok: true; step: SandboxPlanStep }
    | { ok: false; reason: string }

/**
 * Converts Grounding+Expansion's `ParsePlanStep` output (slices 1-2) into the
 * existing `SandboxPlanStep`/`IdentityPlanCandidate` shape the sandbox and
 * live selectors already consume --- without touching either. Reading
 * `validatePlanDryRun.ts` in full showed its legality functions read only a
 * narrow slice of `IdentityPlanCandidate`/`RelationalIdentityPlanCandidate`
 * (`identity.objectId`/`identity.locus`/`plan.operationKind` for membership;
 * `subject.objectId`/`target.objectId`/`plan.operationKind`/`plan.relation`
 * for relational) --- so this converter supplies **real derived values** for
 * those fields and **documented placeholders** for the rest (`confidence`,
 * `label`, `jointRelevance`, `sourceTags`), which are selector-only bookkeeping
 * Validation never reads. If `validateMembershipPlanDryRun`/
 * `validateRelationalPlanDryRun` ever start reading those fields, these
 * placeholders would need revisiting.
 */
const toNormalizedRelation = (
    relationKind: EstablishRelationStep['relationKind'],
    relationLabel: string | undefined
): NormalizedRelation =>
    relationKind === 'Custom'
        ? { type: 'custom', kind: 'Custom', relationLabel: relationLabel ?? '' }
        : { type: 'enum', kind: relationKind }

export const relationalStepToSandboxPlanStep = (
    step: EstablishRelationStep | DissolveRelationStep
): ToSandboxPlanStepResult => {
    const candidate: RelationalIdentityPlanCandidate = {
        subject: {
            objectId: step.subjectId,
            label: '',
            locus: { kind: 'room' },
            jointRelevance: 1,
            sourceTags: [],
        },
        target: {
            objectId: step.targetId,
            label: '',
            locus: { kind: 'room' },
            jointRelevance: 1,
            sourceTags: [],
        },
        plan: {
            kind: step.kind,
            operationKind: step.kind,
            relation: toNormalizedRelation(step.relationKind, step.relationLabel),
        },
        confidence: 1,
    }

    return { ok: true, step: { kind: 'relational', candidate, hostId: step.hostRoomId } }
}

export const transferMembershipToSandboxPlanStep = (
    primaryObjectId: EphemeraObjectId,
    expandedStep: TransferMembershipStep,
    actingCharacterId: EphemeraCharacterId
): ToSandboxPlanStepResult => {
    const { fromHostId, toHostId } = expandedStep

    let operationKind: 'takeHold' | 'drop'
    if (isEphemeraRoomId(fromHostId) && !isEphemeraRoomId(toHostId)) {
        operationKind = 'takeHold'
    }
    else if (!isEphemeraRoomId(fromHostId) && isEphemeraRoomId(toHostId)) {
        operationKind = 'drop'
    }
    else {
        return { ok: false, reason: `Cannot derive operationKind from ${fromHostId} -> ${toHostId} --- not a Room<->Character transfer` }
    }

    const locus = isEphemeraRoomId(fromHostId)
        ? { kind: 'room' as const }
        : fromHostId === actingCharacterId
            ? { kind: 'heldByActor' as const }
            : { kind: 'heldByOtherCharacter' as const, characterId: fromHostId, characterLabel: '' }

    const candidate: IdentityPlanCandidate = {
        identity: {
            objectId: primaryObjectId,
            label: '',
            locus,
            jointRelevance: 1,
            sourceTags: [],
        },
        plan: { kind: 'transferMembership', operationKind },
        confidence: 1,
    }

    return {
        ok: true,
        step: {
            kind: 'transferMembership',
            candidate,
            transferSet: expandedStep.objectIds,
            context: { sourceHostId: fromHostId, destinationHostId: toHostId },
        },
    }
}
