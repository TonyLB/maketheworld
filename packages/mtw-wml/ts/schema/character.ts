import { SchemaCharacterLegalContents, SchemaCharacterTag, isSchemaName, isSchemaPronouns, isSchemaFirstImpression, isSchemaOneCoolThing, isSchemaOutfit, isSchemaImage, SchemaPronounsTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaLiteralLegalContents } from "./baseClasses";
import { ParseCharacterTag, ParseFirstImpressionTag, ParseOneCoolThingTag, ParseOutfitTag, ParsePronounsTag } from "../parser/baseClasses";

export const schemaFromPronouns = (item: ParsePronounsTag): SchemaPronounsTag => ({
    tag: 'Pronouns',
    subject: item.subject,
    object: item.object,
    possessive: item.possessive,
    adjective: item.adjective,
    reflexive: item.reflexive,
    parse: item
})

export const schemaFromFirstImpression = (item: ParseFirstImpressionTag, contents: SchemaLiteralLegalContents[]): SchemaFirstImpressionTag => ({
    tag: 'FirstImpression',
    value: item.value,
    parse: item,
    contents
})

export const schemaFromOneCoolThing = (item: ParseOneCoolThingTag, contents: SchemaLiteralLegalContents[]): SchemaOneCoolThingTag => ({
    tag: 'OneCoolThing',
    value: item.value,
    parse: item,
    contents
})

export const schemaFromOutfit = (item: ParseOutfitTag, contents: SchemaLiteralLegalContents[]): SchemaOutfitTag => ({
    tag: 'Outfit',
    value: item.value,
    parse: item,
    contents
})

export const schemaFromCharacter = (item: ParseCharacterTag, contents: SchemaCharacterLegalContents[]): SchemaCharacterTag => ({
    tag: 'Character',
    key: item.key,
    fileName: item.fileName,
    zone: item.zone,
    subFolder: item.subFolder,
    player: item.player,
    Name: contents.filter(isSchemaName).map(({ name }) => (name)).join(''),
    Pronouns: contents.filter(isSchemaPronouns).reduce((previous, { tag, ...rest }) => (rest), {
        subject: 'they',
        object: 'them',
        possessive: 'theirs',
        adjective: 'their',
        reflexive: 'themself',
        parse: item
    }),
    FirstImpression: contents.filter(isSchemaFirstImpression).length ? contents.filter(isSchemaFirstImpression).map(({ value }) => (value)).join('') : undefined,
    OneCoolThing: contents.filter(isSchemaOneCoolThing).length ? contents.filter(isSchemaOneCoolThing).map(({ value }) => (value)).join('') : undefined,
    Outfit: contents.filter(isSchemaOutfit).length ? contents.filter(isSchemaOutfit).map(({ value }) => (value)).join('') : undefined,
    fileURL: contents.filter(isSchemaImage).reduce<string | undefined>((previous, { fileURL }) => (fileURL), undefined),
    contents,
    parse: item
})

export default schemaFromCharacter
