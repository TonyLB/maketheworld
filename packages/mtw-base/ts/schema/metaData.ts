import { SchemaBase } from "./baseClasses";

export type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Feature' | 'Knowledge' | 'Variable' | 'Computed' | 'Action' | 'Map' | 'Moment'
}

export const isSchemaImportMappingType = (value: string): value is SchemaImportMapping["type"] => (['Room', 'Feature', 'Knowledge', 'Variable', 'Computed', 'Action','Map', 'Moment'].includes(value))

export type SchemaImportTag = {
    tag: 'Import';
    key?: string;
    from: string;
    mapping: Record<string, SchemaImportMapping>;
} & SchemaBase

export type SchemaExportTag = {
    tag: 'Export';
    mapping: Record<string, SchemaImportMapping>
} & SchemaBase

export type SchemaMetaTag = {
    tag: 'Meta';
    key: string;
    time: number;
} & SchemaBase
