import { SchemaImportableBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { ComponentUUID, isSchemaAssetUUID } from ".";
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";

export type SchemaMatchTag = SchemaLiteralTag<'Match'>

export type SchemaMarkTag = {
    tag: 'Mark';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

const { typeGuard: isSchemaMatchTypeGuard } = literalTagFactory<'Match'>('Match')
export const isSchemaMatch = isSchemaMatchTypeGuard

export const isSchemaMark = (schema: any): schema is SchemaMarkTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: {
            tag: 'Mark',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export type SchemaLensTag = {
    tag: 'Lens';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export const isSchemaLens = (schema: any): schema is SchemaLensTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: {
            tag: 'Lens',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)
