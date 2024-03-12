import { SchemaTag } from "../schema/baseClasses";
import { GenericTree, TreeId } from "../tree/baseClasses";

type StandardBase = {
    key: string;
    id: string;
}

export type StandardField<T> = {
    id: string;
    value: T;
}

export type SchemaStandardField = StandardField<GenericTree<SchemaTag, TreeId>>

export type StandardRoom = {
    tag: 'Room';
    shortName: StandardField<string>;
    name: SchemaStandardField;
    summary: SchemaStandardField;
    description: SchemaStandardField;
    exits: GenericTree<SchemaTag, TreeId>;
} & StandardBase

export type StandardFeature = {
    tag: 'Feature';
    name: SchemaStandardField;
    description: SchemaStandardField;
} & StandardBase

export type StandardKnowledge = {
    tag: 'Knowledge';
    name: SchemaStandardField;
    description: SchemaStandardField;
} & StandardBase

export type StandardBookmark = {
    tag: 'Bookmark';
    description: SchemaStandardField;
} & StandardBase

export type StandardMap = {
    tag: 'Map';
    name: SchemaStandardField;
    positions: GenericTree<SchemaTag, TreeId>;
}

export type StandardMessage = {
    tag: 'Message';
    description: SchemaStandardField;
    roomIds: StandardField<string>[];
} & StandardBase

export type StandardMoment = {
    tag: 'Moment';
    messageIds: StandardField<string>[];
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