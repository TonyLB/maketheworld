import { SchemaBase } from "./baseClasses";
import { SchemaNameTag } from "./example";
import { SchemaImageTag } from "./image";
import { SchemaImportTag, SchemaMetaTag } from "./metaData";

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
