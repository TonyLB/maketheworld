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
    key: string;
} & SchemaImportableBase

export const isSchemaNameTag = (schema: any): schema is SchemaNameTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Name' } })(schema)
)

export const isSchemaDescriptionTag = (schema: any): schema is SchemaDescriptionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Description' } })(schema)
)

export const isSchemaSummaryTag = (schema: any): schema is SchemaSummaryTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Summary' } })(schema)
)

export const isSchemaExampleTag = (schema: any): schema is SchemaExampleTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING },
        values: { tag: 'Example' }
    })(schema)
)
