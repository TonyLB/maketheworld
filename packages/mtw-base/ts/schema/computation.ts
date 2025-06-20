import { SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaVariableTag = {
    tag: 'Variable';
    uuid?: ComponentUUID;
    key?: string;
    default?: string;
} & SchemaImportableBase

export type SchemaComputedTag = {
    tag: 'Computed';
    uuid?: ComponentUUID;
    key?: string;
    src: string;
    dependencies?: string[];
} & SchemaImportableBase

export type SchemaActionTag = {
    tag: 'Action';
    uuid?: ComponentUUID;
    key?: string;
    src: string;
} & SchemaImportableBase

export const isSchemaVariable = (schema: any): schema is SchemaVariableTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { default: CheckTypes.STRING, key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING },
        values: {
            tag: 'Variable',
            from: isSchemaAssetUUID
        }
    })(schema)
)

export const isSchemaComputed = (schema: any): schema is SchemaComputedTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, src: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING },
        values: {
            tag: 'Computed',
            dependencies: (dependencies: any) => (Array.isArray(dependencies) && dependencies.every((dependency) => (typeof dependency === 'string'))),
            from: isSchemaAssetUUID
        }
    })(schema)
)

export const isSchemaAction = (schema: any): schema is SchemaActionTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, src: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING },
        values: {
            tag: 'Action',
            from: isSchemaAssetUUID
        }
    })(schema)
)