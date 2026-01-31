import { ComponentUUID, isSchemaAssetUUID } from ".";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { SchemaBase, SchemaImportableBase } from "./baseClasses";

export type SchemaNameTag = {
    tag: 'Name';
} & SchemaBase

/** @deprecated Use SchemaDisplayNameTag for Example/Character display name. Name remains for legacy Room/Feature WML only. */
export const isSchemaName = (schema: any): schema is SchemaNameTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Name' } })(schema)
)

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

export type SchemaExampleTag = {
    tag: 'Example';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export const isSchemaDescription = (schema: any): schema is SchemaDescriptionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Description' } })(schema)
)

export const isSchemaSummary = (schema: any): schema is SchemaSummaryTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Summary' } })(schema)
)

export const isSchemaExample = (schema: any): schema is SchemaExampleTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING, key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: { 
            tag: 'Example', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)
