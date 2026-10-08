import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export type TransferMembershipStep = {
    kind: 'transferMembership'
    objectId: EphemeraObjectId // one object: anything it hosts lives in its own shard and travels with it
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
}

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
