import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes"
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";

export type SchemaShortNameTag = SchemaLiteralTag<'ShortName'>

export type SchemaExitTag = {
    tag: 'Exit';
    key: string;
    to: string;
    from: string;
} & SchemaBase

export type SchemaRoomTag = {
    tag: 'Room';
    uuid?: string;
    key: string;
    x?: number;
    y?: number;
} & SchemaImportableBase

export type SchemaFeatureTag = {
    tag: 'Feature';
    uuid?: string;
    key: string;
    global?: boolean;
} & SchemaImportableBase

export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    key: string;
} & SchemaImportableBase

export type SchemaPositionTag = {
    tag: 'Position';
    x: number;
    y: number;
}

export type SchemaMapTag = {
    tag: 'Map';
    key: string;
} & SchemaImportableBase

export type SchemaMessageTag = {
    tag: 'Message';
    key: string;
} & SchemaImportableBase

export type SchemaMomentTag = {
    tag: 'Moment';
    key: string;
} & SchemaImportableBase

const { typeGuard } = literalTagFactory<'ShortName'>('ShortName')
export const isSchemaShortName = typeGuard

export const isSchemaExit = (schema: any): schema is SchemaExitTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING, to: CheckTypes.STRING, from: CheckTypes.STRING }, values: { tag: 'Exit' } })(schema)
)

export const isSchemaRoom = (schema: any): schema is SchemaRoomTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Room' } })(schema)
)

export const isSchemaFeature = (schema: any): schema is SchemaFeatureTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Feature' } })(schema)
)

export const isSchemaKnowledge = (schema: any): schema is SchemaKnowledgeTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Knowledge' } })(schema)
)

export const isSchemaPosition = (schema: any): schema is SchemaPositionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, x: CheckTypes.NUMBER, y: CheckTypes.NUMBER }, values: { tag: 'Position' } })(schema)
)

export const isSchemaMap = (schema: any): schema is SchemaMapTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Map' } })(schema)
)

export const isSchemaMessage = (schema: any): schema is SchemaMessageTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Message' } })(schema)
)

export const isSchemaMoment = (schema: any): schema is SchemaMomentTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, key: CheckTypes.STRING }, values: { tag: 'Moment' } })(schema)
)