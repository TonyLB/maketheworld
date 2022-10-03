import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist"
import { splitType } from "@tonylb/mtw-utilities/dist/types";
import { ComponentRenderItem, NormalCharacterPronouns } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

type EphemeraWrappedId<T extends string> = `${T}#${string}`

type EphemeraItemDependency = {
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
    EphemeraId: string;
    key: string;
    tag: 'Feature';
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

export type EphemeraRoom = {
    EphemeraId: string;
    key: string;
    tag: 'Room';
    appearances: EphemeraRoomAppearance[];
}

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
    EphemeraId: string;
    key: string;
    tag: 'Map';
    appearances: EphemeraMapAppearance[];
}

export type EphemeraCharacter = {
    EphemeraId: string;
    key: string;
    tag: 'Character';
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

export type EphemeraAction = {
    EphemeraId: string;
    key: string;
    tag: 'Action';
    src: string;
}

export type EphemeraVariable = {
    EphemeraId: string;
    key: string;
    tag: 'Variable';
    default: string;
}

export type EphemeraComputed = {
    EphemeraId: string;
    key: string;
    tag: 'Computed';
    src: string;
    dependencies: EphemeraItemDependency[];
}

export type EphemeraItem = EphemeraFeature | EphemeraRoom | EphemeraMap | EphemeraCharacter | EphemeraAction | EphemeraVariable | EphemeraComputed

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
    mapCache?: any;
    importTree?: any;
    scopeMap?: any;
}