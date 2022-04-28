type TagType = 'Asset' |
    'Story' |
    'Character' |
    'Import' |
    'Condition' |
    'Description' |
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
    location?: number[];
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

export type ComponentRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action';
    key: string;
    to: string;
    text?: string;
    spaceBefore?: boolean;
} | {
    tag: 'String';
    value: string;
    spaceBefore?: boolean;
}

export type NormalDescriptionPayload = {
    type: 'Description';
    render?: ComponentRenderItem[];
    spaceBefore?: boolean;
    spaceAfter?: boolean;
}

export type NormalDescription = NormalDescriptionPayload & NormalBase

export type ComponentAppearance = Omit<NormalDescriptionPayload, 'type'> & BaseAppearance & {
    name?: string;
}

export type NormalRoom = {
    tag: 'Room';
    appearances: ComponentAppearance[];
} & NormalBase

export type NormalFeature = {
    tag: 'Feature';
    appearances: ComponentAppearance[];
} & NormalBase

export type NormalComponent = NormalRoom | NormalFeature

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
    appearances: BaseAppearance[];
} & NormalBase

type MapAppearanceRoom = {
    x: number;
    y: number;
    location: number[];
}

type MapAppearance = {
    rooms: Record<string, MapAppearanceRoom>;
} & BaseAppearance

export type NormalMap = {
    tag: 'Map';
    appearances: MapAppearance[];
} & NormalBase

export type NormalExit = {
    tag: 'Exit';
    to: string;
    from: string;
    appearances?: BaseAppearance[];
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
    NormalComponent |
    NormalImport |
    NormalImage |
    NormalMap |
    NormalExit |
    NormalVariable |
    NormalComputed |
    NormalAction

export type NormalForm = Record<string, NormalItem>

export const normalize = (node: any, existingMap?: any, contextStack?: any, location?: number[]) => NormalForm

export default normalize
