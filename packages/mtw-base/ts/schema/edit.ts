import { SchemaBase, SchemaWrapper } from "./baseClasses"

export type SchemaReplaceTag = {
    tag: 'Replace';
} & SchemaWrapper & SchemaBase

export type SchemaReplaceMatchTag = {
    tag: 'ReplaceMatch';
} & SchemaBase

export type SchemaReplacePayloadTag = {
    tag: 'ReplacePayload';
} & SchemaBase

export type SchemaRemoveTag = {
    tag: 'Remove';
} & SchemaBase

export type SchemaEditTag = SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag
