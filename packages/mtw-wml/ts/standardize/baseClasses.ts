import { SchemaDescriptionTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag } from "../schema/baseClasses";
import { GenericTree, GenericTreeNodeFiltered, TreeId } from "../tree/baseClasses";

type StandardBase = {
    key: string;
    id: string;
}

export type StandardField<T> = {
    id: string;
    value: T;
}

export type StandardCharacter = {
    tag: 'Character';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag, TreeId>;
    oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag, TreeId>;
    outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag, TreeId>;
    pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag, TreeId>;
    image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag, TreeId>;
} & StandardBase

export type StandardRoom = {
    tag: 'Room';
    shortName: GenericTreeNodeFiltered<SchemaShortNameTag, SchemaOutputTag, TreeId>;
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    summary: GenericTreeNodeFiltered<SchemaSummaryTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
    exits: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardFeature = {
    tag: 'Feature';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardKnowledge = {
    tag: 'Knowledge';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardBookmark = {
    tag: 'Bookmark';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
} & StandardBase

export type StandardMap = {
    tag: 'Map';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    images: GenericTree<SchemaTag, TreeId>;
    positions: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardArea = {
    tag: 'Area';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId>;
    rooms: GenericTree<SchemaTag, TreeId>;
    maps: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardMessage = {
    tag: 'Message';
    description: GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaOutputTag, TreeId>;
    rooms: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardMoment = {
    tag: 'Moment';
    messages: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardVariable = {
    tag: 'Variable';
    default: string;
} & StandardBase

export type StandardComputed = {
    tag: 'Computed';
    src: string;
    dependencies?: string[];
} & StandardBase

export type StandardAction = {
    tag: 'Action';
    src: string;
} & StandardBase

export type StandardImage = {
    tag: 'Image';
} & StandardBase

export type StandardComponent =
    StandardCharacter |
    StandardRoom |
    StandardFeature |
    StandardKnowledge |
    StandardBookmark |
    StandardMap |
    StandardArea |
    StandardMessage |
    StandardMoment |
    StandardVariable |
    StandardComputed |
    StandardAction

export const isStandardFactory = <T extends StandardComponent>(tag: T["tag"]) => (value: StandardComponent): value is T => (value.tag === tag)

export const isStandardRoom = isStandardFactory<StandardRoom>("Room")
export const isStandardFeature = isStandardFactory<StandardFeature>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledge>("Knowledge")
export const isStandardBookmark = isStandardFactory<StandardBookmark>("Bookmark")
export const isStandardMap = isStandardFactory<StandardMap>("Map")
export const isStandardArea = isStandardFactory<StandardArea>("Area")
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")
export const isStandardAction = isStandardFactory<StandardAction>("Action")

export type StandardForm = {
    key: string;
    tag: 'Asset' | 'Character';
    byId: Record<string, StandardComponent>;
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
} & SerializableStandardBase

export type SerializableStandardArea = {
    tag: 'Area';
    name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag>;
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
    SerializableStandardArea |
    SerializableStandardMessage |
    SerializableStandardMoment |
    SerializableStandardVariable |
    SerializableStandardComputed |
    SerializableStandardAction

export type SerializableStandardForm = {
    key: string;
    tag: 'Asset' | 'Character';
    byId: Record<string, SerializableStandardComponent>;
    metaData: GenericTree<SchemaTag>;
}
    