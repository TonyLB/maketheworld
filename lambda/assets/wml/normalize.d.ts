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

export type BaseAppearance = {
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
    fileName?: string;
    zone?: string;
} & NormalBase

export type NormalCharacterPronouns = {
    subject: string;
    object: string;
    reflexive: string;
    possessive: string;
    adjective: string;
}

export type NormalCharacter = {
    tag: 'Character';
    Name: string;
    Pronouns: NormalCharacterPronouns;
    FirstImpression: string;
    OneCoolThing: string;
    Outfit: string;
    fileName?: string;
} & NormalBase

export type ComponentRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action';
    to: string;
    text?: string;
    spaceBefore?: boolean;
} | {
    tag: 'String';
    value: string;
    spaceBefore?: boolean;
} | {
    tag: 'LineBreak';
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

type ComponentTypes = 'Room' | 'Feature'

export type NormalComponent = {
    tag: ComponentTypes;
    appearances: ComponentAppearance[];
} & NormalBase

export type NormalRoom = NormalComponent & {
    tag: 'Room';
}

export type NormalFeature = NormalComponent & {
    tag: 'Feature';
}

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

export type ImageAppearance = {
    display?: 'replace'
} & BaseAppearance

type NormalImage = {
    tag: 'Image';
    fileURL?: string;
    appearances: ImageAppearance[];
} & NormalBase

type MapAppearanceRoom = {
    x: number;
    y: number;
    location: number[];
}

type MapAppearanceImage = string

export type MapAppearance = {
    images: MapAppearanceImage[];
    rooms: Record<string, MapAppearanceRoom>;
} & BaseAppearance

export type NormalMap = {
    tag: 'Map';
    appearances: MapAppearance[];
} & NormalBase

type ExitAppearance = {
    name?: string;
} & BaseAppearance

export type NormalExit = {
    tag: 'Exit';
    to: string;
    from: string;
    name?: string;
    appearances?: ExitAppearance[];
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

export function isNormalExit(arg: NormalItem): arg is NormalExit
export function isNormalImage(arg: NormalItem): arg is NormalImage
export function isNormalComponent(arg: NormalItem): arg is NormalComponent
export function isNormalMap(arg: NormalItem): arg is NormalMap
export function isNormalAsset(arg: NormalAsset | NormalCharacter): arg is NormalAsset
export function isNormalAsset(arg: NormalItem): arg is NormalAsset
export function isNormalCharacter(arg: NormalItem): arg is NormalCharacter
export function isNormalImport(arg: NormalItem): arg is NormalImport

export default normalize
