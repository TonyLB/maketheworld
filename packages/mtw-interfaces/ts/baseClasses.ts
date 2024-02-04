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

export type EphemeraActionId = EphemeraWrappedId<'ACTION'>
export const isEphemeraActionId = isEphemeraTaggedId<'ACTION'>('ACTION')

export type EphemeraVariableId = EphemeraWrappedId<'VARIABLE'>
export const isEphemeraVariableId = isEphemeraTaggedId<'VARIABLE'>('VARIABLE')

export type EphemeraComputedId = EphemeraWrappedId<'COMPUTED'>
export const isEphemeraComputedId = isEphemeraTaggedId<'COMPUTED'>('COMPUTED')

export type EphemeraBookmarkId = EphemeraWrappedId<'BOOKMARK'>
export const isEphemeraBookmarkId = isEphemeraTaggedId<'BOOKMARK'>('BOOKMARK')

export type EphemeraMessageId = EphemeraWrappedId<'MESSAGE'>
export const isEphemeraMessageId = isEphemeraTaggedId<'MESSAGE'>('MESSAGE')

export type EphemeraMomentId = EphemeraWrappedId<'MOMENT'>
export const isEphemeraMomentId = isEphemeraTaggedId<'MOMENT'>('MOMENT')

export type EphemeraNotificationId = EphemeraWrappedId<'NOTIFICATION'>
export const isEphemeraNotificationId = isEphemeraTaggedId<'NOTIFICATION'>('NOTIFICATION')

export type EphemeraImageId = EphemeraWrappedId<'IMAGE'>
export const isEphemeraImageId = isEphemeraTaggedId<'IMAGE'>('IMAGE')


export type EphemeraId = EphemeraWrappedId<'ASSET' | 'FEATURE' | 'KNOWLEDGE' | 'ROOM' | 'MAP' | 'CHARACTER' | 'ACTION' | 'VARIABLE' | 'COMPUTED' | 'BOOKMARK' | 'MESSAGE' | 'MOMENT' | 'IMAGE'>
export const isEphemeraId = (value: string): value is EphemeraId => (
    isEphemeraAssetId(value) ||
    isEphemeraFeatureId(value) ||
    isEphemeraKnowledgeId(value) ||
    isEphemeraRoomId(value) ||
    isEphemeraMapId(value) ||
    isEphemeraCharacterId(value) ||
    isEphemeraActionId(value) ||
    isEphemeraVariableId(value) ||
    isEphemeraComputedId(value) ||
    isEphemeraBookmarkId(value) ||
    isEphemeraMessageId(value) ||
    isEphemeraMomentId(value) ||
    isEphemeraImageId(value)
)

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'
