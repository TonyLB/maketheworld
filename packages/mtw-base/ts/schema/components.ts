import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes"

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

export const isSchemaShortNameTag = (schema: any): schema is SchemaShortNameTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'ShortName' } })(schema)
)

export const isSchemaRoomTag = (schema: any): schema is SchemaRoomTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Room' } })(schema)
)

export const isSchemaFeatureTag = (schema: any): schema is SchemaFeatureTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Feature' } })(schema)
)

export const isSchemaKnowledgeTag = (schema: any): schema is SchemaKnowledgeTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Knowledge' } })(schema)
)

export const isSchemaPositionTag = (schema: any): schema is SchemaPositionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, x: CheckTypes.NUMBER, y: CheckTypes.NUMBER }, values: { tag: 'Position' } })(schema)
)

export const isSchemaMapTag = (schema: any): schema is SchemaMapTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Map' } })(schema)
)

export const isSchemaMessageTag = (schema: any): schema is SchemaMessageTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Message' } })(schema)
)

export const isSchemaMomentTag = (schema: any): schema is SchemaMomentTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Moment' } })(schema)
)