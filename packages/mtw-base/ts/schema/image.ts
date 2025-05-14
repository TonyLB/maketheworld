import { SchemaImportableBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { ComponentUUID } from ".";

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    uuid?: ComponentUUID;
    fileURL?: string;
} & SchemaImportableBase

export const isSchemaImage = (schema: any): schema is SchemaImageTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING, fileURL: CheckTypes.STRING, uuid: CheckTypes.STRING },
        values: { tag: 'Image' } })(schema)
)