type TagType = 'Asset' |
    'Story' |
    'Character' |
    'Import' |
    'If' |
    'Description' |
    'Room' |
    'Feature' |
    'Knowledge' |
    'Bookmark' |
    'Image' |
    'Map' |
    'Exit' |
    'Variable' |
    'Computed' |
    'Action' |
    'Character' |
    'Message' |
    'Moment'

export type NormalReference = {
    key: string;
    tag: TagType;
    index: number;
}

export type BaseAppearance = {
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

export type CharacterImage = string

export type NormalCharacter = {
    tag: 'Character';
    Name: string;
    Pronouns: NormalCharacterPronouns;
    FirstImpression: string;
    OneCoolThing: string;
    Outfit: string;
    fileName?: string;
    images: CharacterImage[];
    assets: string[];
    appearances: BaseAppearance[];
} & NormalBase

export type ComponentRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action';
    to: string;
    text: string;
} | {
    tag: 'Bookmark';
    to: string;
} | {
    tag: 'String';
    value: string;
} | {
    tag: 'LineBreak';
} | {
    tag: 'Space';
} | {
    tag: 'After';
    contents: ComponentRenderItem[];
} | {
    tag: 'Replace';
    contents: ComponentRenderItem[];
} | {
    tag: 'Before';
    contents: ComponentRenderItem[];
} | ({
    tag: 'Condition';
    contents: ComponentRenderItem[];
} & NormalConditionMixin)

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

type ComponentTypes = 'Room' | 'Feature' | 'Knowledge'

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

export type NormalKnowledge = NormalComponent & {
    tag: 'Knowledge';
}

export type NormalBookmarkAppearance = Omit<NormalDescriptionPayload, 'type'> & BaseAppearance

export type NormalBookmark = {
    tag: 'Bookmark';
    appearances: NormalBookmarkAppearance[];
} & NormalBase

type NormalImportMapping = {
    key: string; // The key of the import in the namespace it is being imported FROM
    type: string;
}

export type NormalImport = {
    tag: 'Import';
    from: string;
    mapping: Record<string, NormalImportMapping>; // Key of the mapping is the key of the import in the namespace it is being imported TO
    appearances: BaseAppearance[];
} & NormalBase

export type NormalConditionStatement = {
    if: string;
    not?: boolean;
    dependencies: string[];
}

export type NormalConditionMixin = {
    conditions: NormalConditionStatement[];
}

export type NormalCondition = {
    tag: 'If';
    appearances: BaseAppearance[];
} & NormalBase & NormalConditionMixin

export type ImageAppearance = {
    display?: 'replace'
} & BaseAppearance

export type NormalImage = {
    tag: 'Image';
    fileURL?: string;
    appearances: ImageAppearance[];
} & NormalBase

export type MapAppearanceRoom = {
    key: string;
    x: number;
    y: number;
} & NormalConditionMixin

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

export type MessageAppearanceRoom = {
    key: string;
} & NormalConditionMixin

export type MessageAppearance = {
    render: ComponentRenderItem[];
    rooms: MessageAppearanceRoom[];
} & BaseAppearance

export type NormalMessage = {
    tag: 'Message';
    appearances: MessageAppearance[];
} & NormalBase

export type MomentAppearance = {
    messages: string[];
} & BaseAppearance

export type NormalMoment = {
    tag: 'Moment';
    appearances: MomentAppearance[];
} & NormalBase

export type NormalItem = NormalAsset |
    NormalComponent |
    NormalBookmark |
    NormalImport |
    NormalImage |
    NormalMap |
    NormalExit |
    NormalVariable |
    NormalComputed |
    NormalAction |
    NormalCondition |
    NormalCharacter |
    NormalMessage |
    NormalMoment

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
export const isNormalComponent = (arg: NormalItem): arg is NormalComponent => (['Room', 'Feature', 'Knowledge'].includes(arg?.tag))
export const isNormalRoom = (arg: NormalItem): arg is NormalRoom => (arg?.tag === 'Room')
export const isNormalFeature = (arg: NormalItem): arg is NormalFeature => (arg?.tag === 'Feature')
export const isNormalKnowledge = (arg: NormalItem): arg is NormalFeature => (arg?.tag === 'Knowledge')
export const isNormalBookmark = (arg: NormalItem): arg is NormalBookmark => (arg?.tag === 'Bookmark')
export const isNormalMessage = (arg: NormalItem): arg is NormalMessage => (arg?.tag === 'Message')
export const isNormalMoment = (arg: NormalItem): arg is NormalMoment => (arg?.tag === 'Moment')
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
