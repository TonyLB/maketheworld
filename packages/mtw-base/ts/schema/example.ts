import { ComponentUUID } from ".";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { SchemaBase, SchemaImportableBase } from "./baseClasses";

export type SchemaNameTag = {
    tag: 'Name';
} & SchemaBase

export type SchemaDescriptionTag = {
    tag: 'Description';
} & SchemaBase

export type SchemaSummaryTag = {
    tag: 'Summary';
} & SchemaBase

export type SchemaExampleTag = {
    tag: 'Example';
    uuid?: ComponentUUID;
    key: string;
} & SchemaImportableBase

export const isSchemaName = (schema: any): schema is SchemaNameTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Name' } })(schema)
)

export const isSchemaDescription = (schema: any): schema is SchemaDescriptionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Description' } })(schema)
)

export const isSchemaSummary = (schema: any): schema is SchemaSummaryTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Summary' } })(schema)
)

export const isSchemaExample = (schema: any): schema is SchemaExampleTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING, key: CheckTypes.STRING, uuid: CheckTypes.STRING },
        values: { tag: 'Example' }
    })(schema)
)
