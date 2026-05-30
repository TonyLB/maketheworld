import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import checkTypes, { CheckTypes } from "../utils/checkTypes"
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaShortNameTag = SchemaLiteralTag<'ShortName'>
export type SchemaInstructionsTag = SchemaLiteralTag<'Instructions'>
export type SchemaDefaultTag = SchemaLiteralTag<'Default'>
export type SchemaForwardTag = SchemaLiteralTag<'Forward'>
export type SchemaBackTag = SchemaLiteralTag<'Back'>

export type SchemaParentTag = {
    tag: 'Parent';
}

export type SchemaFromTag = {
    tag: 'From';
}

export type SchemaToTag = {
    tag: 'To';
}

export type SchemaKeyTag = {
    tag: 'Key';
}

export type SchemaObjectTag = {
    tag: 'Object';
    uuid: string;
}

export type SchemaRenderTag = {
    tag: 'Render';
}

export type SchemaExitTag = {
    tag: 'Exit';
    to?: string;
    uuid?: string;
} & SchemaBase

export type SchemaRoomTag = {
    tag: 'Room';
    uuid?: ComponentUUID;
    key?: string;
    x?: number;
    y?: number;
    ref?: number;
} & SchemaImportableBase

export type SchemaFeatureTag = {
    tag: 'Feature';
    uuid?: ComponentUUID;
    key?: string;
    global?: boolean;
    ref?: number;
} & SchemaImportableBase

export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
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
    ref?: number;
} & SchemaImportableBase

export type SchemaMessageTag = {
    tag: 'Message';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export type SchemaMomentTag = {
    tag: 'Moment';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export type SchemaGuidanceTag = {
    tag: 'Guidance';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export type SchemaSituationTag = {
    tag: 'Situation';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

export type SchemaAreaTag = {
    tag: 'Area';
    uuid?: ComponentUUID;
    key?: string;
    ref?: number;
} & SchemaImportableBase

const { typeGuard } = literalTagFactory<'ShortName'>('ShortName')
export const isSchemaShortName = typeGuard

const { typeGuard: isSchemaInstructionsTypeGuard } = literalTagFactory<'Instructions'>('Instructions')
export const isSchemaInstructions = isSchemaInstructionsTypeGuard

const { typeGuard: isSchemaDefaultTypeGuard } = literalTagFactory<'Default'>('Default')
export const isSchemaDefault = isSchemaDefaultTypeGuard

const { typeGuard: isSchemaForwardTypeGuard } = literalTagFactory<'Forward'>('Forward')
export const isSchemaForward = isSchemaForwardTypeGuard

const { typeGuard: isSchemaBackTypeGuard } = literalTagFactory<'Back'>('Back')
export const isSchemaBack = isSchemaBackTypeGuard

export const isSchemaParent = (schema: any): schema is SchemaParentTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'Parent' }
    })(schema)
)

export const isSchemaFrom = (schema: any): schema is SchemaFromTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'From' }
    })(schema)
)

export const isSchemaTo = (schema: any): schema is SchemaToTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'To' }
    })(schema)
)

export const isSchemaKey = (schema: any): schema is SchemaKeyTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'Key' }
    })(schema)
)

export const isSchemaObject = (schema: any): schema is SchemaObjectTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING, uuid: CheckTypes.STRING },
        values: { tag: 'Object' }
    })(schema)
)

export const isSchemaRender = (schema: any): schema is SchemaRenderTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        values: { tag: 'Render' }
    })(schema)
)

export const isSchemaExit = (schema: any): schema is SchemaExitTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { to: CheckTypes.STRING, uuid: CheckTypes.STRING },
        values: { tag: 'Exit' }
    })(schema)
)

export const isSchemaRoom = (schema: any): schema is SchemaRoomTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
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
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
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
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
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
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
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
        optional: { key: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
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
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: { 
            tag: 'Moment', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaGuidance = (schema: any): schema is SchemaGuidanceTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: { 
            tag: 'Guidance', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaSituation = (schema: any): schema is SchemaSituationTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: { 
            tag: 'Situation', 
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)

export const isSchemaArea = (schema: any): schema is SchemaAreaTag => (
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, uuid: CheckTypes.STRING, from: CheckTypes.STRING, ref: CheckTypes.NUMBER },
        values: {
            tag: 'Area',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)