import { SchemaImportableBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    fileURL?: string;
} & SchemaImportableBase

export const isSchemaImage = (schema: any): schema is SchemaImageTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING },
        optional: { as: CheckTypes.STRING, fileURL: CheckTypes.STRING },
        values: { tag: 'Image' } })(schema)
)