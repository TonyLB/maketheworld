import { SchemaImportableBase } from "./baseClasses"

export type SchemaVariableTag = {
    tag: 'Variable';
    key: string;
    default?: string;
} & SchemaImportableBase

export type SchemaComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies?: string[];
} & SchemaImportableBase

export type SchemaActionTag = {
    tag: 'Action';
    key: string;
    src: string;
} & SchemaImportableBase

