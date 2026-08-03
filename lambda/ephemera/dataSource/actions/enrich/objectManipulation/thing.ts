import {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraObjectId,
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * CPG-5's referent-kind abstraction (see `dataSource/actions/AGENT.concepts.md`): the
 * three `EphemeraPositionGraph`-groundable referent kinds Object-manipulation-style
 * resolution (Identify/Grounding) can point at, as one named union rather than the
 * ad hoc `EphemeraObjectId | EphemeraCharacterId` pair repeated at each call site.
 * Knowledge is deliberately excluded --- it has no graph position and routes through
 * `WorldQuestion` instead, not Grounding (see the planning doc's Phase 2 notes).
 */
export type EphemeraThingId = EphemeraObjectId | EphemeraCharacterId | EphemeraFeatureId

export const isEphemeraThingId = (value: unknown): value is EphemeraThingId =>
    typeof value === 'string'
    && (isEphemeraObjectId(value) || isEphemeraCharacterId(value) || isEphemeraFeatureId(value))
