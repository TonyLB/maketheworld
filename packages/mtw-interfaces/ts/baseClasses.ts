import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

//
// Centralized zone type definitions
//
export type Zone = 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'

export const isZone = (value: string): value is Zone => {
    return ['Canon', 'Library', 'Personal', 'Draft', 'Archive'].includes(value)
}

//
// Improvisation participation layer (I3). Logical AssetUUID for merge order; rows live in ephemeraDB.
// Not a Zone enum member (Zone maps to assetDB residence).
//
export const IMPROVISATION_ASSET_ID = 'ASSET#IMPROVISATION' as const satisfies AssetUUID

export const isImprovisationAssetId = (value: string): value is typeof IMPROVISATION_ASSET_ID =>
    value === IMPROVISATION_ASSET_ID

/** Display label for diagnostics / participation-order UI when improvisation layer is present. */
export const IMPROVISATION_ZONE_LABEL = 'Improvisation' as const

export class EphemeraError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'EphemeraException'
    }
}

type EphemeraWrappedId<T extends string> = `${T}#${string}`

export const isEphemeraTaggedId = <G extends string>(tag: G) => (value: string): value is EphemeraWrappedId<G> => {
    const sections = value.split('#')
    if (sections.length > 2) {
        throw new EphemeraError(`Illegal nested EphemeraId: '${value}'`)
    }
    if (sections.length < 2) {
        return false
    }
    return Boolean(sections[0] === tag)
}

export type EphemeraAssetId = EphemeraWrappedId<'ASSET'>
export const isEphemeraAssetId = isEphemeraTaggedId<'ASSET'>('ASSET')

export type EphemeraFeatureId = EphemeraWrappedId<'FEATURE'>
export const isEphemeraFeatureId = isEphemeraTaggedId<'FEATURE'>('FEATURE')

export type EphemeraKnowledgeId = EphemeraWrappedId<'KNOWLEDGE'>
export const isEphemeraKnowledgeId = isEphemeraTaggedId<'KNOWLEDGE'>('KNOWLEDGE')

export type EphemeraRoomId = EphemeraWrappedId<'ROOM'>
export const isEphemeraRoomId = isEphemeraTaggedId<'ROOM'>('ROOM')

export type EphemeraMapId = EphemeraWrappedId<'MAP'>
export const isEphemeraMapId = isEphemeraTaggedId<'MAP'>('MAP')

export type EphemeraCharacterId = EphemeraWrappedId<'CHARACTER'>
export const isEphemeraCharacterId = isEphemeraTaggedId<'CHARACTER'>('CHARACTER')

export type EphemeraObjectId = EphemeraWrappedId<'OBJECT'>
export const isEphemeraObjectId = isEphemeraTaggedId<'OBJECT'>('OBJECT')

export type EphemeraMessageId = EphemeraWrappedId<'MESSAGE'>
export const isEphemeraMessageId = isEphemeraTaggedId<'MESSAGE'>('MESSAGE')

export type EphemeraMomentId = EphemeraWrappedId<'MOMENT'>
export const isEphemeraMomentId = isEphemeraTaggedId<'MOMENT'>('MOMENT')

export type EphemeraImageId = EphemeraWrappedId<'IMAGE'>
export const isEphemeraImageId = isEphemeraTaggedId<'IMAGE'>('IMAGE')

export type EphemeraSituationId = EphemeraWrappedId<'SITUATION'>
export const isEphemeraSituationId = isEphemeraTaggedId<'SITUATION'>('SITUATION')

//
// EphemeraId is the allowlist of id tags the ephemera/messaging layer treats as first-class
// (cache keys, message targets, aggregate universal keys, etc.). It is aligned with current
// SchemaComponent-backed ComponentUUID tags where they overlap, but maintained by hand:
// e.g. OBJECT# (room object facets in ephemera meta) is included here but not ComponentUUID;
// MARK / LENS / GUIDANCE are ComponentUUID-only until ephemera adopts them.
// EXAMPLE# was removed: Example is no longer a schema component (authored slices use SITUATION#).
// Legacy EXAMPLE# strings may still appear in stored WML or PerceptionMessage metadata types.
//
export type EphemeraId = EphemeraWrappedId<'ASSET' | 'FEATURE' | 'KNOWLEDGE' | 'ROOM' | 'MAP' | 'CHARACTER' | 'OBJECT' | 'MESSAGE' | 'MOMENT' | 'IMAGE' | 'SITUATION'>
export const isEphemeraId = (value: string): value is EphemeraId => (
    isEphemeraAssetId(value) ||
    isEphemeraFeatureId(value) ||
    isEphemeraKnowledgeId(value) ||
    isEphemeraRoomId(value) ||
    isEphemeraMapId(value) ||
    isEphemeraCharacterId(value) ||
    isEphemeraObjectId(value) ||
    isEphemeraMessageId(value) ||
    isEphemeraMomentId(value) ||
    isEphemeraImageId(value) ||
    isEphemeraSituationId(value)
)

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'
