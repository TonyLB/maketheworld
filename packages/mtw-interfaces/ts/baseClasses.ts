//
// Centralized zone type definitions
//
export type Zone = 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'

export const isZone = (value: string): value is Zone => {
    return ['Canon', 'Library', 'Personal', 'Draft', 'Archive'].includes(value)
}

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

export type EphemeraExampleId = EphemeraWrappedId<'EXAMPLE'>
export const isEphemeraExampleId = isEphemeraTaggedId<'EXAMPLE'>('EXAMPLE')

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
// EphemeraId is the set of id tags that the ephemera/messaging layer treats as first-class
// (cache keys, message targets, etc.). It is a subset of ComponentUUID (mtw-base/schema),
// which is driven by SchemaComponent and includes additional tags (e.g. MARK, LENS, GUIDANCE).
// When a new component type needs to be referenced in ephemera, add it here.
// Redundancy: this union is maintained by hand; consider re-evaluating whether to derive
// from ComponentUUID or a shared tag union in future.
//
export type EphemeraId = EphemeraWrappedId<'ASSET' | 'EXAMPLE' | 'FEATURE' | 'KNOWLEDGE' | 'ROOM' | 'MAP' | 'CHARACTER' | 'OBJECT' | 'MESSAGE' | 'MOMENT' | 'IMAGE' | 'SITUATION'>
export const isEphemeraId = (value: string): value is EphemeraId => (
    isEphemeraAssetId(value) ||
    isEphemeraExampleId(value) ||
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
