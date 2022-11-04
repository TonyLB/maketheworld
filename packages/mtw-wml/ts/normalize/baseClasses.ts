type TagType = 'Asset' |
    'Story' |
    'Character' |
    'Import' |
    'If' |
    'Description' |
    'Room' |
    'Feature' |
    'Image' |
    'Map' |
    'Exit' |
    'Variable' |
    'Computed' |
    'Action' |
    'Character'

export type NormalReference = {
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
    fileURL?: string;
    appearances: BaseAppearance[];
} & NormalBase

export type ComponentRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action';
    to: string;
    text: string;
} | {
    tag: 'String';
    value: string;
} | {
    tag: 'LineBreak';
} | {
    tag: 'Space';
} | {
    tag: 'Condition';
    if: string;
    dependencies: string[];
    contents: ComponentRenderItem[];
}

export type NormalDescriptionPayload = {
    type: 'Description';
    render?: ComponentRenderItem[];
}

export type NormalDescription = NormalDescriptionPayload & NormalBase

export type ComponentAppearance = Omit<NormalDescriptionPayload, 'type'> & BaseAppearance & {
    name?: ComponentRenderItem[];
    x?: number;
    y?: number;
}

type ComponentTypes = 'Room' | 'Feature'

export type NormalComponent = {
    tag: ComponentTypes;
    appearances: ComponentAppearance[];
    global?: boolean;
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

export type NormalCondition = {
    tag: 'If';
    if: string;
    dependencies: string[];
    appearances: BaseAppearance[];
} & NormalBase

export type ImageAppearance = {
    display?: 'replace'
} & BaseAppearance

export type NormalImage = {
    tag: 'Image';
    fileURL?: string;
    appearances: ImageAppearance[];
} & NormalBase

export type MapAppearanceRoom = {
    conditions: {
        if: string;
        dependencies: string[]
    }[];
    key: string;
    x: number;
    y: number;
    location: number[];
}

type MapAppearanceImage = string

export type MapAppearance = {
    name: ComponentRenderItem[];
    images: MapAppearanceImage[];
    rooms: MapAppearanceRoom[];
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

export type NormalVariable = {
    tag: 'Variable';
    default: string;
    appearances: BaseAppearance[];
} & NormalBase

export type NormalComputed = {
    tag: 'Computed';
    src: string;
    dependencies: string[];
    appearances: BaseAppearance[];
} & NormalBase

export type NormalAction = {
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
    NormalAction |
    NormalCondition |
    NormalCharacter

export type NormalForm = Record<string, NormalItem>

export class WMLNormalizeError extends Error {
    constructor(message: string) {
        super(`WMLNormalize: ${message}`)
        this.name = 'WMLNormalizeError'
    }
}

export class NormalizeTagMismatchError extends WMLNormalizeError {
    constructor(message: string) {
        super(message)
        this.name = 'TagMismatchError'
    }
}

export class NormalizeKeyMismatchError extends WMLNormalizeError {
    constructor(message: string) {
        super(message)
        this.name = 'KeyTagMismatchError'
    }
}

export const isNormalExit = (arg: NormalItem): arg is NormalExit => (arg?.tag === 'Exit')
export const isNormalImage = (arg: NormalItem): arg is NormalImage => (arg?.tag === 'Image')
export const isNormalComponent = (arg: NormalItem): arg is NormalComponent => (['Room', 'Feature'].includes(arg?.tag))
export const isNormalRoom = (arg: NormalItem): arg is NormalRoom => (arg?.tag === 'Room')
export const isNormalFeature = (arg: NormalItem): arg is NormalFeature => (arg?.tag === 'Feature')
export const isNormalMap = (arg: NormalItem): arg is NormalMap => (arg?.tag === 'Map')
export function isNormalAsset(arg: NormalItem): arg is NormalAsset {
    return arg?.tag === 'Asset'
}
export const isNormalCharacter = (arg: NormalItem): arg is NormalCharacter => (arg?.tag === 'Character')
export const isNormalImport = (arg: NormalItem): arg is NormalImport => (arg?.tag === 'Import')
export const isNormalCondition = (arg: NormalItem): arg is NormalCondition => (arg.tag === 'If')
export const isNormalVariable = (arg: NormalItem): arg is NormalVariable => (arg.tag === 'Variable')
export const isNormalComputed = (arg: NormalItem): arg is NormalComputed => (arg.tag === 'Computed')
export const isNormalAction = (arg: NormalItem): arg is NormalAction => (arg.tag === 'Action')
