import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { SchemaBase } from "./baseClasses";

export type SchemaGrantTag = {
    tag: 'Grant';
    player: string;
    actions: string[];
} & SchemaBase

export const isSchemaGrant = (schema: any): schema is SchemaGrantTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, player: CheckTypes.STRING }, values: { tag: 'Name' } })(schema)
    && Array.isArray(schema.actions) && schema.actions.every((action: any) => typeof action === 'string')
)
