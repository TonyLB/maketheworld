import { SchemaBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";

export type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Area' | 'Feature' | 'Knowledge' | 'Map' | 'Moment' | 'Message' | 'Lens'
}

export const isSchemaImportMapping = (schema: any): schema is SchemaImportMapping => (
    checkTypes({
        required: { key: CheckTypes.STRING, type: CheckTypes.STRING },
        values: { type: (type: string) => (['Room', 'Area', 'Feature', 'Knowledge', 'Map', 'Moment', 'Message', 'Lens'].includes(type)) }
    })(schema)
)

export const isSchemaImportMappingType = (value: string): value is SchemaImportMapping["type"] => (['Room', 'Area', 'Feature', 'Knowledge', 'Map', 'Moment', 'Message', 'Lens'].includes(value))

export type SchemaImportTag = {
    tag: 'Import';
    key?: string;
    from: string;
    mapping: Record<string, SchemaImportMapping>;
} & SchemaBase

export const isSchemaImport = (schema: any): schema is SchemaImportTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, from: CheckTypes.STRING, mapping: CheckTypes.OBJECT },
        optional: { key: CheckTypes.STRING },
        values: {
            tag: 'Import'
        }
    })(schema)
)