import { SchemaBase, SchemaImportableBase } from "./baseClasses";

export type SchemaShortNameTag = {
    tag: 'ShortName';
} & SchemaBase

export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    x?: number;
    y?: number;
} & SchemaImportableBase

export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global?: boolean;
} & SchemaImportableBase

export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    key: string;
} & SchemaImportableBase

export type SchemaPositionTag = {
    tag: 'Position';
    x: number;
    y: number;
}

export type SchemaMapTag = {
    tag: 'Map';
    key: string;
} & SchemaImportableBase

export type SchemaMessageTag = {
    tag: 'Message';
    key: string;
} & SchemaImportableBase

export type SchemaMomentTag = {
    tag: 'Moment';
    key: string;
} & SchemaImportableBase

