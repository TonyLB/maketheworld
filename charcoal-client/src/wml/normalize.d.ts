type TagType = 'Asset' |
    'Story' |
    'Character' |
    'Import' |
    'Condition' |
    'Room' |
    'Feature' |
    'Image' |
    'Map' |
    'Exit' |
    'Variable' |
    'Computed' |
    'Action'

type NormalReference = {
    key: string;
    tag: TagType;
    index: number;
}

type BaseAppearance = {
    contextStack: NormalReference[];
    contents: NormalReference[];
}

type NormalBase = {
    key: string;
}

export type NormalAsset = {
    tag: 'Asset';
    Story?: boolean;
    instance?: boolean;
    appearances: BaseAppearance[];
} & NormalBase

export type NormalCharacter = {
    type: 'Character';
    Name: string;
    Pronouns: any;
    FirstImpression: string;
    OneCoolThing: string;
    Outfit: string;
} & NormalBase

export type RoomRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action';
    key: string;
    to: string;
    text?: string;
} | string

export type RoomAppearance = {
    name?: string;
    render?: RoomRenderItem[];
} & BaseAppearance

export type NormalRoom = {
    tag: 'Room';
    appearances: RoomAppearance[];
} & NormalBase

type NormalImportMapping = {
    key: string;
    type: string;
}

export type NormalImport = {
    tag: 'Import';
    from: string;
    mapping: Record<string, NormalImportMapping>;
    appearances: BaseAppearance[];
} & NormalBase

type NormalImage = {
    tag: 'Image';
    fileURL?: string;
    appearances: BaseAppearance;
} & NormalBase

type MapAppearance = {
    rooms: Record<string, { x: number; y: number }>;
} & BaseAppearance

type NormalMap = {
    tag: 'Map';
    appearances: MapAppearance[];
} & NormalBase

type NormalExit = {
    tag: 'Exit';
    to: string;
    from: string;
} & NormalBase

type FeatureAppearance = {
    render?: RoomRenderItem[];
} & BaseAppearance

export type NormalFeature = {
    tag: 'Feature';
    name: string;
    appearances: BaseAppearance[];
} & NormalBase

type NormalVariable = {
    tag: 'Variable';
    default: string;
    appearances: BaseAppearance[];
} & NormalBase

type NormalComputed = {
    tag: 'Computed';
    src: string;
    dependencies: string[];
    appearances: BaseAppearance[];
} & NormalBase

type NormalAction = {
    tag: 'Action';
    src: string;
    appearances: BaseAppearance[];
} & NormalBase

export type NormalItem = NormalAsset |
    NormalRoom |
    NormalImport |
    NormalImage |
    NormalMap |
    NormalExit |
    NormalFeature |
    NormalVariable |
    NormalComputed |
    NormalAction

export type NormalForm = Record<string, NormalItem>

export const normalize = (node: any, existingMap?: any, contextStack?: any) => NormalForm

export default normalize
