import { SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes";

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

export const isSchemaVariable = (schema: any): schema is SchemaVariableTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, optional: { default: CheckTypes.STRING }, values: { tag: 'Variable' } })(schema)
)

export const isSchemaComputed = (schema: any): schema is SchemaComputedTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING, src: CheckTypes.STRING },
        values: {
            tag: 'Computed',
            dependencies: (dependencies) => (Array.isArray(dependencies) && dependencies.every((dependency) => (typeof dependency === 'string')))
        }
    })(schema)
)

export const isSchemaAction = (schema: any): schema is SchemaActionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING, src: CheckTypes.STRING }, values: { tag: 'Action' } })(schema)
)