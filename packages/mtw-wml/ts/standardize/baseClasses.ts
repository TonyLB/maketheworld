import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag } from "../schema/baseClasses";
import { GenericTree, GenericTreeNodeFiltered, TreeId } from "../tree/baseClasses";

type StandardBase = {
    key: string;
    id: string;
}

export type StandardField<T> = {
    id: string;
    value: T;
}

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
} & StandardBase

export type StandardAction = {
    tag: 'Action';
    src: string;
} & StandardBase

export type StandardImage = {
    tag: 'Image';
} & StandardBase

export type StandardComponent =
    StandardRoom |
    StandardFeature |
    StandardKnowledge |
    StandardBookmark |
    StandardMap |
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
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")

export type StandardForm = Record<string, StandardComponent>
