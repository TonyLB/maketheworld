//
// Centralized zone type definitions
//
export type Zone = 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'

export const isZone = (value: string): value is Zone => {
    return ['Canon', 'Library', 'Personal', 'Draft', 'Archive'].includes(value)
}

//
// Duplicate of the types from AssetWorkspace, to avoid a full import
//
type AssetWorkspaceConstructorBase = {
    fileName: string;
    subFolder?: string;
}

type AssetWorkspaceConstructorCanon = {
    zone: 'Canon';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorLibrary = {
    zone: 'Library';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorPersonal = {
    zone: 'Personal';
    player: string;
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorDraft = {
    zone: 'Draft';
    player: string;
}

type AssetWorkspaceConstructorArchive = {
    zone: 'Archive';
    backupId: `BACKUP#${string}`;
}

export type AssetWorkspaceAddress = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal | AssetWorkspaceConstructorDraft | AssetWorkspaceConstructorArchive

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



export type EphemeraMessageId = EphemeraWrappedId<'MESSAGE'>
export const isEphemeraMessageId = isEphemeraTaggedId<'MESSAGE'>('MESSAGE')

export type EphemeraMomentId = EphemeraWrappedId<'MOMENT'>
export const isEphemeraMomentId = isEphemeraTaggedId<'MOMENT'>('MOMENT')

export type EphemeraImageId = EphemeraWrappedId<'IMAGE'>
export const isEphemeraImageId = isEphemeraTaggedId<'IMAGE'>('IMAGE')


export type EphemeraId = EphemeraWrappedId<'ASSET' | 'EXAMPLE' | 'FEATURE' | 'KNOWLEDGE' | 'ROOM' | 'MAP' | 'CHARACTER' | 'MESSAGE' | 'MOMENT' | 'IMAGE'>
export const isEphemeraId = (value: string): value is EphemeraId => (
    isEphemeraAssetId(value) ||
    isEphemeraExampleId(value) ||
    isEphemeraFeatureId(value) ||
    isEphemeraKnowledgeId(value) ||
    isEphemeraRoomId(value) ||
    isEphemeraMapId(value) ||
    isEphemeraCharacterId(value) ||
    isEphemeraMessageId(value) ||
    isEphemeraMomentId(value) ||
    isEphemeraImageId(value)
)

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'
