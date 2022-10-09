import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist"
import { splitType } from "@tonylb/mtw-utilities/dist/types";
import { ComponentRenderItem, NormalCharacterPronouns } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

type EphemeraWrappedId<T extends string> = `${T}#${string}`

export type EphemeraItemDependency = {
    key: string;
    EphemeraId: string;
}

export type EphemeraCondition = {
    dependencies: EphemeraItemDependency[];
    if: string;
}

export type EphemeraFeatureId = EphemeraWrappedId<'FEATURE'>
export const isEphemeraFeatureId = (key: string): key is EphemeraFeatureId => (splitType(key)[0] === 'FEATURE')

export type EphemeraFeatureAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
}

export type EphemeraFeature = {
    EphemeraId: EphemeraFeatureId;
    key: string;
    appearances: EphemeraFeatureAppearance[];
}

export type EphemeraExit = {
    name: string;
    to: string;
}

export type EphemeraRoomAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
    exits: EphemeraExit[];
}

export type EphemeraRoomId = EphemeraWrappedId<'ROOM'>
export const isEphemeraRoomId = (key: string): key is EphemeraRoomId => (splitType(key)[0] === 'ROOM')

export type EphemeraRoom = {
    EphemeraId: EphemeraRoomId;
    key: string;
    appearances: EphemeraRoomAppearance[];
}

export type EphemeraMapId = EphemeraWrappedId<'MAP'>
export const isEphemeraMapId = (key: string): key is EphemeraMapId => (splitType(key)[0] === 'MAP')

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
}

export type EphemeraMapAppearance = {
    conditions: EphemeraCondition[];
    fileURL: string;
    name: string;
    rooms: Record<string, EphemeraMapRoom>;
}

export type EphemeraMap = {
    EphemeraId: EphemeraMapId;
    key: string;
    appearances: EphemeraMapAppearance[];
}

export type EphemeraCharacterId = EphemeraWrappedId<'CHARACTER'>
export const isEphemeraCharacterId = (key: string): key is EphemeraCharacterId => (splitType(key)[0] === 'CHARACTER')

export type EphemeraCharacter = {
    EphemeraId: EphemeraCharacterId;
    key: string;
    address: AssetWorkspaceAddress;
    Name: string;
    Pronouns: NormalCharacterPronouns;
    FirstImpression: string;
    OneCoolThing?: string;
    Outfit?: string;
    Color: 'blue' | 'purple' | 'green' | 'pink';
    fileURL?: string;
    Connected: boolean;
    ConnectionIds: string[];
    RoomId: string;
}

export type EphemeraActionId = EphemeraWrappedId<'ACTION'>
export const isEphemeraActionId = (key: string): key is EphemeraActionId => (splitType(key)[0] === 'ACTION')

export type EphemeraAction = {
    EphemeraId: EphemeraActionId;
    key: string;
    src: string;
}

export type EphemeraVariableId = EphemeraWrappedId<'VARIABLE'>
export const isEphemeraVariableId = (key: string): key is EphemeraVariableId => (splitType(key)[0] === 'VARIABLE')

export type EphemeraVariable = {
    EphemeraId: EphemeraVariableId;
    key: string;
    default: string;
}

export type EphemeraComputedId = EphemeraWrappedId<'COMPUTED'>
export const isEphemeraComputedId = (key: string): key is EphemeraComputedId => (splitType(key)[0] === 'COMPUTED')

export type EphemeraComputed = {
    EphemeraId: EphemeraComputedId;
    key: string;
    src: string;
    dependencies: EphemeraItemDependency[];
}

export type EphemeraItem = EphemeraFeature | EphemeraRoom | EphemeraMap | EphemeraCharacter | EphemeraAction | EphemeraVariable | EphemeraComputed

type LegalEphemeraTag = 'Asset' | (EphemeraItem['EphemeraId'] extends `${infer T}#${string}` ? Capitalize<Lowercase<T>> : never)

const isLegalEphemeraTag = (tag: string): tag is LegalEphemeraTag => (['Asset', 'Room', 'Map', 'Character', 'Action', 'Variable', 'Computed'].includes(tag))

export const tagFromEphemeraWrappedId = (EphemeraId: string): LegalEphemeraTag => {
    const [upperTag] = splitType(EphemeraId)
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (isLegalEphemeraTag(tag)) {
        return tag
    }
    else {
        throw new Error(`Invalid dependency tag: ${tag}`)
    }
}

export type EphemeraDependencyImport = {
    key: string;
    asset: string;
}

export type EphemeraDependencies = {
    room?: string[];
    map?: string[];
    mapCache?: string[];
    computed?: string[];
    imported?: EphemeraDependencyImport[];
}

export type EphemeraStateComputed = {
    key: string;
    computed: true;
    src: string;
    value?: any;
}

export type EphemeraStateVariable = {
    key: string;
    computed?: false;
    imported?: false;
    value: any;
}

export type EphemeraStateImport = {
    key: string;
    computed?: false;
    imported: true;
    value: any;
    asset: string;
}

type EphemeraStateItem = EphemeraStateComputed | EphemeraStateVariable | EphemeraStateImport

export type EphemeraState = {
    [key: string]: EphemeraStateItem
}

export const isEphemeraStateVariable = (item: EphemeraStateItem): item is EphemeraStateVariable => (!(item.computed || item.imported))
export const isEphemeraStateComputed = (item: EphemeraStateItem): item is EphemeraStateComputed => (item.computed || false)
export const isEphemeraStateImport = (item: EphemeraStateItem): item is EphemeraStateImport => (!(item.computed || false) && (item.imported || false))

export type EphemeraImportStateItem = {
    state: EphemeraState;
    dependencies: Record<string, EphemeraDependencies>;
}

export type EphemeraImportState = {
    [key: string]: EphemeraImportStateItem;
}
export type EphemeraPushArgs = {
    EphemeraId: string;
    State: EphemeraState;
    Dependencies?: EphemeraDependencies;
    Actions?: any;
    importTree?: any;
    scopeMap?: any;
}