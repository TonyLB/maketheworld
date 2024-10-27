import { SchemaDescriptionTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPromptTag, SchemaPronounsTag, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../schema/baseClasses";
import { GenericTree, GenericTreeFiltered, GenericTreeNodeFiltered } from "../tree/baseClasses";

export class StandardizerError extends Error {}
export class MergeConflictError extends StandardizerError {
    constructor(message?: string) {
        super(message ?? 'Merge conflict')
    }
}

type StandardBase = {
    key: string;
    update?: boolean;
}

export type StandardNodeKeys<T extends StandardBase> = Exclude<{
        [K in keyof T]: T[K] extends GenericTreeNodeFiltered<any, any, any> | undefined ? K : never
    }[keyof T], (undefined | 'key' | 'id' | 'update')>

type StandardNonNodeKeys<T extends StandardBase> = Exclude<{
        [K in Exclude<keyof T, 'key' | 'id' | 'update'>]: T[K] extends GenericTreeNodeFiltered<any, any, any> ? never : K
    }[Exclude<keyof T, 'key' | 'id' | 'update'>], undefined>

type StandardUpdateItem <T extends StandardBase> = {
    [K in StandardNodeKeys<T>]?: T[K]
} & {
    [K in StandardNonNodeKeys<T>]: T[K];
} & {
    update: true;
} & StandardBase

export type StandardCharacter = {
    tag: 'Character';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    firstImpression?: EditWrappedStandardNode<SchemaFirstImpressionTag, SchemaTag>;
    oneCoolThing?: EditWrappedStandardNode<SchemaOneCoolThingTag, SchemaTag>;
    outfit?: EditWrappedStandardNode<SchemaOutfitTag, SchemaTag>;
    pronouns?: EditWrappedStandardNode<SchemaPronounsTag, SchemaTag>;
    image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
} & StandardBase

export type StandardCharacterUpdate = StandardUpdateItem<StandardCharacter>

export type StandardRoom = {
    tag: 'Room';
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & StandardBase

export type StandardRoomUpdate = StandardUpdateItem<StandardRoom>

export type StandardFeature = {
    tag: 'Feature';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBase

export type StandardFeatureUpdate = StandardUpdateItem<StandardFeature>

export type StandardKnowledge = {
    tag: 'Knowledge';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBase

export type StandardKnowledgeUpdate = StandardUpdateItem<StandardKnowledge>

export type StandardBookmark = {
    tag: 'Bookmark';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBase

export type StandardBookmarkUpdate = StandardUpdateItem<StandardBookmark>

export type StandardMap = {
    tag: 'Map';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    images: GenericTree<SchemaTag>;
    positions: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & StandardBase

export type StandardMapUpdate = StandardUpdateItem<StandardMap>

export type StandardTheme = {
    tag: 'Theme';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    rooms: GenericTree<SchemaTag>;
    maps: GenericTree<SchemaTag>;
} & StandardBase

export type StandardThemeUpdate = StandardUpdateItem<StandardTheme>

export type StandardMessage = {
    tag: 'Message';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    rooms: GenericTree<SchemaTag>;
} & StandardBase

export type StandardMessageUpdate = StandardUpdateItem<StandardMessage>

export type StandardMoment = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag>;
} & StandardBase

export type StandardMomentUpdate = StandardUpdateItem<StandardMoment>

export type StandardVariable = {
    tag: 'Variable';
    default: string;
} & StandardBase

export type StandardVariableUpdate = StandardUpdateItem<StandardVariable>

export type StandardComputed = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & StandardBase

export type StandardComputedUpdate = StandardUpdateItem<StandardComputed>

export type StandardAction = {
    tag: 'Action';
    src: string;
} & StandardBase

export type StandardActionUpdate = StandardUpdateItem<StandardAction>

export type StandardImage = {
    tag: 'Image';
} & StandardBase

export type StandardImageUpdate = StandardUpdateItem<StandardImage>

export type StandardComponentNonEdit =
    StandardCharacter |
    StandardRoom |
    StandardFeature |
    StandardKnowledge |
    StandardBookmark |
    StandardMap |
    StandardTheme |
    StandardMessage |
    StandardMoment |
    StandardVariable |
    StandardComputed |
    StandardAction |
    StandardImage

export type StandardRemove = {
    tag: 'Remove';
    component: StandardComponentNonEdit;
} & StandardBase

export type StandardReplace = {
    tag: 'Replace';
    match: StandardComponentNonEdit;
    payload: StandardComponentNonEdit;
} & StandardBase

export const unwrapStandardComponent = (component: StandardComponent): StandardComponentNonEdit => {
    if (isStandardNonEdit(component)) {
        return component
    }
    else if (isStandardRemove(component)) {
        return component.component
    }
    else {
        return component.payload
    }
}

export type StandardComponent = StandardComponentNonEdit | StandardRemove | StandardReplace

export const isStandardFactory = <T extends StandardComponent>(tag: T["tag"]) => (value: StandardComponent): value is T => (value.tag === tag)

export const isStandardCharacter = isStandardFactory<StandardCharacter>("Character")
export const isStandardRoom = isStandardFactory<StandardRoom>("Room")
export const isStandardFeature = isStandardFactory<StandardFeature>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledge>("Knowledge")
export const isStandardBookmark = isStandardFactory<StandardBookmark>("Bookmark")
export const isStandardMap = isStandardFactory<StandardMap>("Map")
export const isStandardTheme = isStandardFactory<StandardTheme>("Theme")
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")
export const isStandardAction = isStandardFactory<StandardAction>("Action")
export const isStandardVariable = isStandardFactory<StandardVariable>("Variable")
export const isStandardComputed = isStandardFactory<StandardComputed>("Computed")
export const isStandardImage = isStandardFactory<StandardImage>("Image")

export const isStandardRemove = isStandardFactory<StandardRemove>("Remove")
export const isStandardReplace = isStandardFactory<StandardReplace>("Replace")

export const isStandardNonEdit = (value: StandardComponent): value is Exclude<StandardComponent, StandardRemove | StandardReplace> => (!["Remove", "Replace"].includes(value.tag))

export const defaultComponentFromTag = (tag: SchemaTag["tag"], key: string): StandardComponent => {
    switch(tag) {
        case 'Room':
            return {
                tag,
                key,
                exits: [],
                themes: []
            }
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
                key,
            }
        case 'Image':
            return {
                tag: 'Image' as const,
                key,
            }
        case 'Variable':
            return {
                tag: 'Variable' as const,
                key,
                default: 'false',
            }
        case 'Computed':
            return {
                tag: 'Computed' as const,
                key,
                src: '',
            }
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                src: '',
            }
        case 'Map':
            return {
                tag: 'Map' as const,
                key,
                themes: [],
                images: [],
                positions: [],
            }
        case 'Theme':
            return {
                tag: 'Theme' as const,
                key,
                prompts: [],
                rooms: [],
                maps: [],
            }
        default:
            throw new Error(`No default component for tag: '${tag}'`)
    }
}

export type EditInternalStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = GenericTreeNodeFiltered<T, ChildType, Extra>

export type EditWrappedStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = {
    data: SchemaRemoveTag;
    children: EditInternalStandardNode<T, ChildType, Extra>[];
} | {
    data: SchemaReplaceTag;
    children: { data: SchemaReplaceMatchTag | SchemaReplacePayloadTag, children: EditInternalStandardNode<T, ChildType, Extra>[] }[];
} | EditInternalStandardNode<T, ChildType, Extra>

export type StandardForm = {
    key: string;
    tag: 'Asset' | 'Character';
    update?: boolean;
    byId: Record<string, StandardComponent>;
    metaData: GenericTree<SchemaTag>;
}

export type StandardAsset = {
    tag: 'Asset';
} & StandardBase

export type SerializeNDJSONMixin = {
    from?: {
        assetId: string;
        key: string;
    };
    exportAs?: string;
    universalKey?: string;
    fileName?: string;
}

export type StandardNDJSON = (({ tag: 'Asset' } & StandardBase) | (StandardComponent & SerializeNDJSONMixin))[]
