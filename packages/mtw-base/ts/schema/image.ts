import { SchemaImportableBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    uuid?: ComponentUUID;
    fileURL?: string;
    apply?: number;
} & SchemaImportableBase

export const isSchemaImage = (schema: any): schema is SchemaImageTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING, fileURL: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: { 
            tag: 'Image', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)