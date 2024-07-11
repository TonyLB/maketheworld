import { SchemaDescriptionTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPromptTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../schema/baseClasses";
import { GenericTree, GenericTreeFiltered, GenericTreeNodeFiltered, TreeId } from "../tree/baseClasses";

type StandardBase = {
    key: string;
    id: string;
}

type StandardNodeKeys<T extends StandardBase> = Exclude<{
        [K in Exclude<keyof T, 'key' | 'id'>]: T[K] extends GenericTreeNodeFiltered<any, any, any> ? K : never
    }[Exclude<keyof T, 'key' | 'id'>], undefined>

type StandardNonNodeKeys<T extends StandardBase> = Exclude<{
        [K in Exclude<keyof T, 'key' | 'id'>]: T[K] extends GenericTreeNodeFiltered<any, any, any> ? never : K
    }[Exclude<keyof T, 'key' | 'id'>], undefined>

type StandardUpdateItem <T extends StandardBase> = {
    [K in StandardNodeKeys<T>]?: T[K]
} & {
    [K in StandardNonNodeKeys<T>]: T[K];
} & {
    update: true;
} & StandardBase

export type StandardCharacter = {
    tag: 'Character';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag, TreeId>;
    oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag, TreeId>;
    outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag, TreeId>;
    pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag, TreeId>;
    image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag, TreeId>;
} & StandardBase

export type StandardCharacterUpdate = StandardUpdateItem<StandardCharacter>

export type StandardRoom = {
    tag: 'Room';
    shortName: GenericTreeNodeFiltered<SchemaShortNameTag, SchemaOutputTag, TreeId>;
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    summary: GenericTreeNodeFiltered<SchemaSummaryTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
    exits: GenericTree<SchemaTag, TreeId>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag, TreeId>;
} & StandardBase

export type StandardRoomUpdate = StandardUpdateItem<StandardRoom>

export type StandardFeature = {
    tag: 'Feature';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardFeatureUpdate = StandardUpdateItem<StandardFeature>

export type StandardKnowledge = {
    tag: 'Knowledge';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardKnowledgeUpdate = StandardUpdateItem<StandardKnowledge>

export type StandardBookmark = {
    tag: 'Bookmark';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardBookmarkUpdate = StandardUpdateItem<StandardBookmark>

export type StandardMap = {
    tag: 'Map';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    images: GenericTree<SchemaTag, TreeId>;
    positions: GenericTree<SchemaTag, TreeId>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag, TreeId>;
} & StandardBase

export type StandardMapUpdate = StandardUpdateItem<StandardMap>

export type StandardTheme = {
    tag: 'Theme';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag, TreeId>;
    rooms: GenericTree<SchemaTag, TreeId>;
    maps: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardThemeUpdate = StandardUpdateItem<StandardTheme>

export type StandardMessage = {
    tag: 'Message';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
    rooms: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardMessageUpdate = StandardUpdateItem<StandardMessage>

export type StandardMoment = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag, TreeId>;
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

export type StandardComponent =
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

export type StandardAbstractComponent =
    StandardCharacter |
    StandardCharacterUpdate |
    StandardRoom |
    StandardRoomUpdate |
    StandardFeature |
    StandardFeatureUpdate |
    StandardKnowledge |
    StandardKnowledgeUpdate |
    StandardBookmark |
    StandardBookmarkUpdate |
    StandardMap |
    StandardMapUpdate |
    StandardTheme |
    StandardThemeUpdate |
    StandardMessage |
    StandardMessageUpdate |
    StandardMoment |
    StandardMomentUpdate |
    StandardVariable |
    StandardVariableUpdate |
    StandardComputed |
    StandardComputedUpdate |
    StandardAction |
    StandardActionUpdate |
    StandardImage |
    StandardImageUpdate

export const isStandardFactory = <T extends StandardComponent>(tag: T["tag"]) => (value: StandardComponent): value is T => (value.tag === tag)

export const isStandardRoom = isStandardFactory<StandardRoom>("Room")
export const isStandardFeature = isStandardFactory<StandardFeature>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledge>("Knowledge")
export const isStandardBookmark = isStandardFactory<StandardBookmark>("Bookmark")
export const isStandardMap = isStandardFactory<StandardMap>("Map")
export const isStandardTheme = isStandardFactory<StandardTheme>("Theme")
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")
export const isStandardAction = isStandardFactory<StandardAction>("Action")
export const isStandardImage = isStandardFactory<StandardImage>("Image")

export type StandardForm = {
    key: string;
    tag: 'Asset' | 'Character';
    byId: Record<string, StandardComponent>;
    metaData: GenericTree<SchemaTag, TreeId>;
}

export type StandardAbstractForm = {
    key: string;
    tag: 'Asset' | 'Character';
    update: boolean;
    byId: Record<string, StandardAbstractComponent>;
    metaData: GenericTree<SchemaTag, TreeId>;
}

type SerializableStandardBase = {
    key: string;
}

export type SerializableStandardCharacter = {
    tag: 'Character';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag>;
    oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag>;
    outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag>;
    pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag>;
    image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardRoom = {
    tag: 'Room';
    shortName: GenericTreeNodeFiltered<SchemaShortNameTag, SchemaOutputTag>;
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    summary: GenericTreeNodeFiltered<SchemaSummaryTag, SchemaOutputTag>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardFeature = {
    tag: 'Feature';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag>;
} & SerializableStandardBase

export type SerializableStandardKnowledge = {
    tag: 'Knowledge';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag>;
} & SerializableStandardBase

export type SerializableStandardBookmark = {
    tag: 'Bookmark';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag>;
} & SerializableStandardBase

export type SerializableStandardMap = {
    tag: 'Map';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    images: GenericTree<SchemaTag>;
    positions: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardTheme = {
    tag: 'Theme';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
    prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    rooms: GenericTree<SchemaTag>;
    maps: GenericTree<SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardMessage = {
    tag: 'Message';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag>;
    rooms: GenericTree<SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardMoment = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag>;
} & SerializableStandardBase

export type SerializableStandardVariable = {
    tag: 'Variable';
    default: string;
} & SerializableStandardBase

export type SerializableStandardComputed = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & SerializableStandardBase

export type SerializableStandardAction = {
    tag: 'Action';
    src: string;
} & SerializableStandardBase

export type SerializableStandardImage = {
    tag: 'Image';
} & SerializableStandardBase

export type SerializableStandardComponent =
    SerializableStandardCharacter |
    SerializableStandardRoom |
    SerializableStandardFeature |
    SerializableStandardKnowledge |
    SerializableStandardBookmark |
    SerializableStandardMap |
    SerializableStandardTheme |
    SerializableStandardMessage |
    SerializableStandardMoment |
    SerializableStandardVariable |
    SerializableStandardComputed |
    SerializableStandardAction |
    SerializableStandardImage

export type SerializableStandardForm = {
    key: string;
    tag: 'Asset' | 'Character';
    byId: Record<string, SerializableStandardComponent>;
    metaData: GenericTree<SchemaTag>;
}
    