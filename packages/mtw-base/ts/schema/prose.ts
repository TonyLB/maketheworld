import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { SchemaBase } from "./baseClasses";

export type SchemaDisplayNameTag = {
    tag: 'DisplayName';
} & SchemaBase

export const isSchemaDisplayName = (schema: any): schema is SchemaDisplayNameTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'DisplayName' } })(schema)
)

export type SchemaDescriptionTag = {
    tag: 'Description';
} & SchemaBase

export type SchemaSummaryTag = {
    tag: 'Summary';
} & SchemaBase

export const isSchemaDescription = (schema: any): schema is SchemaDescriptionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Description' } })(schema)
)

export const isSchemaSummary = (schema: any): schema is SchemaSummaryTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Summary' } })(schema)
)
