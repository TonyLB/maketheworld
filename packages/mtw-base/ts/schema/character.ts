import { SchemaBase } from "./baseClasses";
import { SchemaNameTag } from "./example";
import { SchemaImageTag } from "./image";
import { SchemaImportTag, SchemaMetaTag } from "./metaData";
import checkTypes, { CheckTypes } from "../utils/checkTypes";

export type SchemaCharacterLegalContents = SchemaNameTag | SchemaPronounsTag | SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag

export type SchemaPronouns = {
    subject: string;
    object: string;
    possessive: string;
    adjective: string;
    reflexive: string;
}

export type SchemaPronounsTag = {
    tag: 'Pronouns';
} & SchemaPronouns & SchemaBase

export type SchemaFirstImpressionTag = {
    tag: 'FirstImpression';
    value: string;
} & SchemaBase

export type SchemaOneCoolThingTag = {
    tag: 'OneCoolThing';
    value: string;
} & SchemaBase

export type SchemaOutfitTag = {
    tag: 'Outfit';
    value: string;
} & SchemaBase

export type SchemaCharacterTag = {
    tag: 'Character';
    key: string;
    Pronouns: SchemaPronouns;
    update?: boolean;
} & SchemaBase

export const isSchemaPronouns = (schema: any): schema is SchemaPronounsTag => (
    checkTypes({
        required: {
            tag: CheckTypes.STRING,
            subject: CheckTypes.STRING,
            object: CheckTypes.STRING,
            possessive: CheckTypes.STRING,
            adjective: CheckTypes.STRING,
            reflexive: CheckTypes.STRING
        },
        values: { tag: 'Pronouns' }
    })(schema)
)

export const isSchemaFirstImpression = (schema: any): schema is SchemaFirstImpressionTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, value: CheckTypes.STRING }, values: { tag: 'FirstImpression' } })(schema)
)

export const isSchemaOneCoolThing = (schema: any): schema is SchemaOneCoolThingTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, value: CheckTypes.STRING }, values: { tag: 'OneCoolThing' } })(schema)
)

export const isSchemaOutfit = (schema: any): schema is SchemaOutfitTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, value: CheckTypes.STRING }, values: { tag: 'Outfit' } })(schema)
)

export const isSchemaCharacter = (schema: any): schema is SchemaCharacterTag => (
    checkTypes({
        required: {
            tag: CheckTypes.STRING,
            key: CheckTypes.STRING,
            Pronouns: CheckTypes.OBJECT
        },
        values: {
            tag: 'Character',
            Pronouns: (value: any): boolean => (
                checkTypes({ required: { subject: CheckTypes.STRING, object: CheckTypes.STRING, possessive: CheckTypes.STRING, adjective: CheckTypes.STRING, reflexive: CheckTypes.STRING } })(value)
            )
        }
    })(schema)
)