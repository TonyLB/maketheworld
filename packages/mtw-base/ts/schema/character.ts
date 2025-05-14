import { SchemaBase } from "./baseClasses";
import { SchemaNameTag } from "./example";
import { SchemaImageTag } from "./image";
import { SchemaImportTag, SchemaMetaTag } from "./metaData";
import checkTypes, { CheckTypes } from "../utils/checkTypes";
import { literalTagFactory, SchemaLiteralTag } from "./literalTagFactory";
import { SchemaShortNameTag } from "./components";
import { SchemaRemoveTag, SchemaReplaceTag } from "./edit";
import { ComponentUUID } from ".";

export type SchemaCharacterLegalContents = SchemaNameTag | SchemaShortNameTag | SchemaRemoveTag | SchemaReplaceTag | SchemaPronounsTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag

export type SchemaPronounsTag = SchemaLiteralTag<'Pronouns'>

export type SchemaCharacterTag = {
    tag: 'Character';
    key: string;
    uuid?: ComponentUUID;
    update?: boolean;
} & SchemaBase

export const { typeGuard: isSchemaPronouns } = literalTagFactory('Pronouns')

export const isSchemaCharacter = (schema: any): schema is SchemaCharacterTag => (
    checkTypes({
        required: {
            tag: CheckTypes.STRING,
            key: CheckTypes.STRING,
        },
        optional: {
            uuid: CheckTypes.STRING,
            update: CheckTypes.BOOLEAN,
        },
        values: {
            tag: 'Character'
        }
    })(schema)
)