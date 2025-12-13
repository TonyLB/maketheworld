import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes"
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaShortNameTag = SchemaLiteralTag<'ShortName'>

export type SchemaParentTag = {
    tag: 'Parent';
}

export type SchemaExitTag = {
    tag: 'Exit';
    to: string;
} & SchemaBase

export type SchemaRoomTag = {
    tag: 'Room';
    uuid?: ComponentUUID;
    key?: string;
    x?: number;
    y?: number;
    apply?: number;
} & SchemaImportableBase

export type SchemaFeatureTag = {
    tag: 'Feature';
    uuid?: ComponentUUID;
    key?: string;
    global?: boolean;
    apply?: number;
} & SchemaImportableBase

export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    uuid?: ComponentUUID;
    key?: string;
    apply?: number;
} & SchemaImportableBase

export type SchemaPositionTag = {
    tag: 'Position';
    x: number;
    y: number;
}

export type SchemaMapTag = {
    tag: 'Map';
    uuid?: ComponentUUID;
    key?: string;
    apply?: number;
} & SchemaImportableBase

export type SchemaMessageTag = {
    tag: 'Message';
    uuid?: ComponentUUID;
    key?: string;
    apply?: number;
} & SchemaImportableBase

export type SchemaMomentTag = {
    tag: 'Moment';
    uuid?: ComponentUUID;
    key?: string;
    apply?: number;
} & SchemaImportableBase

const { typeGuard } = literalTagFactory<'ShortName'>('ShortName')
export const isSchemaShortName = typeGuard

export const isSchemaParent = (schema: any): schema is SchemaParentTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'Parent' }
    })(schema)
)

export const isSchemaExit = (schema: any): schema is SchemaExitTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, to: CheckTypes.STRING },
        values: { tag: 'Exit' }
    })(schema)
)

export const isSchemaRoom = (schema: any): schema is SchemaRoomTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: {
            tag: 'Room',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaFeature = (schema: any): schema is SchemaFeatureTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: {
            tag: 'Feature',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaKnowledge = (schema: any): schema is SchemaKnowledgeTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING},
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: { 
            tag: 'Knowledge', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaPosition = (schema: any): schema is SchemaPositionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, x: CheckTypes.NUMBER, y: CheckTypes.NUMBER }, values: { tag: 'Position' } })(schema)
)

export const isSchemaMap = (schema: any): schema is SchemaMapTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: { 
            tag: 'Map', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaMessage = (schema: any): schema is SchemaMessageTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: { 
            tag: 'Message', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaMoment = (schema: any): schema is SchemaMomentTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, apply: CheckTypes.NUMBER },
        values: { 
            tag: 'Moment', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)