import { SchemaBase, SchemaWrapper } from "./baseClasses";

export type SchemaSelectedTag = {
    tag: 'Selected';
} & SchemaBase

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
