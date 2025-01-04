import { SchemaBase, SchemaWrapper } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes";

export type SchemaReplaceTag = {
    tag: 'Replace';
} & SchemaWrapper & SchemaBase

export type SchemaReplaceMatchTag = {
    tag: 'ReplaceMatch';
} & SchemaBase

export type SchemaReplacePayloadTag = {
    tag: 'ReplacePayload';
} & SchemaBase

export type SchemaRemoveTag = {
    tag: 'Remove';
} & SchemaBase

export type SchemaEditTag = SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag

export const isSchemaReplaceTag = (schema: any): schema is SchemaReplaceTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Replace' } })(schema)
)

export const isSchemaReplaceMatchTag = (schema: any): schema is SchemaReplaceMatchTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'ReplaceMatch' } })(schema)
)

export const isSchemaReplacePayloadTag = (schema: any): schema is SchemaReplacePayloadTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'ReplacePayload' } })(schema)
)

export const isSchemaRemoveTag = (schema: any): schema is SchemaRemoveTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Remove' } })(schema)
)
export const isSchemaEditTag = (schema: any): schema is SchemaEditTag => (
    isSchemaRemoveTag(schema) ||
    isSchemaReplaceTag(schema) ||
    isSchemaReplaceMatchTag(schema) ||
    isSchemaReplacePayloadTag(schema)
)