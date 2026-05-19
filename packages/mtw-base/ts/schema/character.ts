import { SchemaImportableBase } from "./baseClasses";
import { SchemaDisplayNameTag } from "./prose";
import { SchemaImageTag } from "./image";
import { SchemaImportTag } from "./metaData";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";
import { SchemaShortNameTag } from "./components";
import { SchemaRemoveTag, SchemaReplaceTag } from "./edit";
import { ComponentUUID, isSchemaAssetUUID } from ".";

export type SchemaCharacterLegalContents = SchemaDisplayNameTag | SchemaShortNameTag | SchemaRemoveTag | SchemaReplaceTag | SchemaPronounsTag | SchemaImageTag | SchemaImportTag

export type SchemaPronounsTag = SchemaLiteralTag<'Pronouns'>

export type SchemaCharacterTag = {
    tag: 'Character';
    key?: string;
    uuid?: ComponentUUID;
    update?: boolean;
    ref?: number;
} & SchemaImportableBase

export const { typeGuard: isSchemaPronouns } = literalTagFactory('Pronouns')

export const isSchemaCharacter = (schema: any): schema is SchemaCharacterTag => (
    checkTypes({
        required: {
            tag: CheckTypes.STRING,
        },
        optional: {
            key: CheckTypes.STRING,
            uuid: CheckTypes.STRING,
            update: CheckTypes.BOOLEAN,
            from: CheckTypes.STRING,
            ref: CheckTypes.NUMBER,
        },
        values: {
            tag: 'Character',
            from: isSchemaAssetUUID,
            origin: (origin: any) => (!origin || (Array.isArray(origin) && origin.every((item: any) => isSchemaAssetUUID(item))))
        }
    })(schema)
)