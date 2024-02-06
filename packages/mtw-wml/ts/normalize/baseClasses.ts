import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from "../tree/baseClasses";
import { SchemaTag } from "../schema/baseClasses";

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

export const isNormalReference = (value: NormalReference | SchemaTag): value is NormalReference => {
    const keys = Object.keys(value)
    return (keys.length === 3 && keys.includes('key') && keys.includes('tag') && keys.includes('index'))
}

export type BaseAppearance<Extra extends {} = {}> = GenericTreeNodeFiltered<SchemaTag, NormalReference | SchemaTag, Extra> & {
    contextStack: (NormalReference | SchemaTag)[];
}

type NormalBase<Extra extends {} = {}> = {
    key: string;
    exportAs?: string;
    appearances: BaseAppearance<Extra>[];
}

export type NormalAsset<Extra extends {} = {}> = {
    tag: 'Asset';
    Story?: boolean;
    instance?: boolean;
    fileName?: string;
    zone?: string;
} & NormalBase<Extra>

export type NormalCharacterPronouns = {
    subject: string;
    object: string;
    reflexive: string;
    possessive: string;
    adjective: string;
}

export type CharacterImage = string

export type NormalCharacter<Extra extends {} = {}> = {
    tag: 'Character';
    Pronouns: NormalCharacterPronouns;
    images: CharacterImage[];
    assets: string[];
} & NormalBase<Extra>

export type ComponentRenderItem = {
    tag: 'Link';
    targetTag: 'Feature' | 'Action' | 'Knowledge';
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

type ComponentTypes = 'Room' | 'Feature' | 'Knowledge'

export type NormalComponent<Extra extends {} = {}> = {
    tag: ComponentTypes;
} & NormalBase<Extra>

export type NormalRoom<Extra extends {} = {}> = NormalComponent<Extra> & {
    tag: 'Room';
}

export type NormalFeature<Extra extends {} = {}> = NormalComponent<Extra> & {
    tag: 'Feature';
}

export type NormalKnowledge<Extra extends {} = {}> = NormalComponent<Extra> & {
    tag: 'Knowledge';
}

export type NormalBookmark<Extra extends {} = {}> = {
    tag: 'Bookmark';
} & NormalBase<Extra>

type NormalImportMapping = {
    key: string; // The key of the import in the namespace it is being imported FROM
    type: string;
}

export type NormalImport<Extra extends {} = {}> = {
    tag: 'Import';
    from: string;
    mapping: Record<string, NormalImportMapping>; // Key of the mapping is the key of the import in the namespace it is being imported TO
} & NormalBase<Extra>

export type NormalConditionStatement = {
    if: string;
    not?: boolean;
    dependencies?: string[];
}

export type NormalConditionMixin = {
    conditions: NormalConditionStatement[];
}

export type NormalImage<Extra extends {} = {}> = {
    tag: 'Image';
    fileURL?: string;
} & NormalBase<Extra>

export type NormalMap<Extra extends {} = {}> = {
    tag: 'Map';
} & NormalBase<Extra>

export type NormalExit<Extra extends {} = {}> = {
    tag: 'Exit';
    to: string;
    from: string;
} & NormalBase<Extra>

export type NormalVariable<Extra extends {} = {}> = {
    tag: 'Variable';
    default: string;
} & NormalBase<Extra>

export type NormalComputed<Extra extends {} = {}> = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & NormalBase<Extra>

export type NormalAction<Extra extends {} = {}> = {
    tag: 'Action';
    src: string;
} & NormalBase<Extra>

export type NormalMessage<Extra extends {} = {}> = {
    tag: 'Message';
} & NormalBase<Extra>

export type NormalMoment<Extra extends {} = {}> = {
    tag: 'Moment';
} & NormalBase<Extra>

export type NormalItem<Extra extends {} = {}> = NormalAsset<Extra> |
    NormalComponent<Extra> |
    NormalBookmark<Extra> |
    NormalImport<Extra> |
    NormalImage<Extra> |
    NormalMap<Extra> |
    NormalExit<Extra> |
    NormalVariable<Extra> |
    NormalComputed<Extra> |
    NormalAction<Extra> |
    NormalCharacter<Extra> |
    NormalMessage<Extra> |
    NormalMoment<Extra>

export type NormalForm<Extra extends {} = {}> = Record<string, NormalItem<Extra>>

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
export const isNormalKnowledge = (arg: NormalItem): arg is NormalKnowledge => (arg?.tag === 'Knowledge')
export const isNormalBookmark = (arg: NormalItem): arg is NormalBookmark => (arg?.tag === 'Bookmark')
export const isNormalMessage = (arg: NormalItem): arg is NormalMessage => (arg?.tag === 'Message')
export const isNormalMoment = (arg: NormalItem): arg is NormalMoment => (arg?.tag === 'Moment')
export const isNormalMap = (arg: NormalItem): arg is NormalMap => (arg?.tag === 'Map')
export function isNormalAsset(arg: NormalItem): arg is NormalAsset {
    return arg?.tag === 'Asset'
}
export const isNormalCharacter = (arg: NormalItem): arg is NormalCharacter => (arg?.tag === 'Character')
export const isNormalImport = (arg: NormalItem): arg is NormalImport => (arg?.tag === 'Import')
export const isNormalVariable = (arg: NormalItem): arg is NormalVariable => (arg.tag === 'Variable')
export const isNormalComputed = (arg: NormalItem): arg is NormalComputed => (arg.tag === 'Computed')
export const isNormalAction = (arg: NormalItem): arg is NormalAction => (arg.tag === 'Action')
