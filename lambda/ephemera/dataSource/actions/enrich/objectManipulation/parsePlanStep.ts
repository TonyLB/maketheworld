import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export type TransferMembershipStep = {
    kind: 'transferMembership'
    objectIds: ReadonlySet<EphemeraObjectId> // BD-13: a set, not a single id --- carry-closure produces multi-member transfers
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
}

export type EstablishRelationStep = {
    kind: 'establishRelation'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    // Widened from EphemeraRoomId (BD-16, 2026-07-21): sameHost repair can ground
    // a relation onto a Character-inventory host, not just a Room.
    hostRoomId: EphemeraMembershipHostId
}

export type DissolveRelationStep = {
    kind: 'dissolveRelation'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    // Widened from EphemeraRoomId (BD-16, 2026-07-21): sameHost repair can ground
    // a relation onto a Character-inventory host, not just a Room.
    hostRoomId: EphemeraMembershipHostId
}

export type ParsePlanStep = TransferMembershipStep | EstablishRelationStep | DissolveRelationStep

/**
 * The closed set of primitives the executor (C2) may ever run. `resolveComponent`
 * is deliberately absent --- grounding is the selector verdict + existence/presence
 * guard in the compiler tail, not an executable step (same reasoning applies to any
 * future Assertion: it gates/evaluates, it does not produce a kernel effect).
 */
export const RUNTIME_PRIMITIVE_NAMES = ['transferMembership', 'establishRelation', 'dissolveRelation'] as const

export type RuntimePrimitiveName = typeof RUNTIME_PRIMITIVE_NAMES[number]

export function isRuntimePrimitiveName(value: unknown): value is RuntimePrimitiveName {
    return typeof value === 'string' && (RUNTIME_PRIMITIVE_NAMES as readonly string[]).includes(value)
}

export function isTransferMembershipStep(step: ParsePlanStep): step is TransferMembershipStep {
    return step.kind === 'transferMembership'
}

export function isEstablishRelationStep(step: ParsePlanStep): step is EstablishRelationStep {
    return step.kind === 'establishRelation'
}

export function isDissolveRelationStep(step: ParsePlanStep): step is DissolveRelationStep {
    return step.kind === 'dissolveRelation'
}
