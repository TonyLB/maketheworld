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

type NormalAsset = {
    tag: 'Asset',
    Story?: boolean,
    instance?: boolean,
    appearances: BaseAppearance[];
} & NormalBase

export type RoomAppearance = {
    name?: string;
    render?: any[];
} & BaseAppearance

type NormalRoom = {
    tag: 'Room';
    appearances: RoomAppearance[];
} & NormalBase

type NormalImport = {
    tag: 'Import';
    from: string;
    mapping: Record<string, string>;
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
    render?: any[];
} & BaseAppearance

type NormalFeature = {
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
