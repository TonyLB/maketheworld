import { SchemaImportableBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaMarkTag = {
    tag: 'Mark';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

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
