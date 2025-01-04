import { SchemaBase, SchemaImportableBase } from "./baseClasses";

export type SchemaNameTag = {
    tag: 'Name';
} & SchemaBase

export type SchemaDescriptionTag = {
    tag: 'Description';
} & SchemaBase

export type SchemaSummaryTag = {
    tag: 'Summary';
} & SchemaBase

export type SchemaExampleTag = {
    tag: 'Example';
    key: string;
} & SchemaImportableBase
