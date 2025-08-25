import { SchemaBase, SchemaWrapper } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";



export type SchemaConditionTag = {
    tag: 'If';
} & SchemaWrapper & SchemaBase

export type SchemaConditionStatementTag = {
    tag: 'Statement';
    if: string;
    selected?: boolean;
    dependencies?: string[]
} & SchemaBase

export type SchemaConditionFallthroughTag = {
    tag: 'Fallthrough';
    selected?: boolean;
} & SchemaBase



export const isSchemaCondition = (schema: any): schema is SchemaConditionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'If' } })(schema)
)

export const isSchemaConditionStatement = (schema: any): schema is SchemaConditionStatementTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, if: CheckTypes.STRING }, values: { tag: 'Statement' } })(schema)
)

export const isSchemaConditionFallthrough = (schema: any): schema is SchemaConditionFallthroughTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Fallthrough' } })(schema)
)