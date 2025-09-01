import { SchemaBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";

export type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Feature' | 'Knowledge' | 'Variable' | 'Computed' | 'Action' | 'Map' | 'Moment'
}

export const isSchemaImportMapping = (schema: any): schema is SchemaImportMapping => (
    checkTypes({
        required: { key: CheckTypes.STRING, type: CheckTypes.STRING },
        values: { type: (type: string) => (['Room', 'Feature', 'Knowledge', 'Variable', 'Computed', 'Action', 'Map', 'Moment'].includes(type)) }
    })(schema)
)

export const isSchemaImportMappingType = (value: string): value is SchemaImportMapping["type"] => (['Room', 'Feature', 'Knowledge', 'Variable', 'Computed', 'Action','Map', 'Moment'].includes(value))

export type SchemaImportTag = {
    tag: 'Import';
    key?: string;
    from: string;
    mapping: Record<string, SchemaImportMapping>;
} & SchemaBase

export type SchemaMetaTag = {
    tag: 'Meta';
    key: string;
    time: number;
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

export const isSchemaMeta = (schema: any): schema is SchemaMetaTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING, time: CheckTypes.NUMBER },
        values: { tag: 'Meta' }
    })(schema)
)