import { SchemaLineBreakTag, SchemaSpacerTag, SchemaWhitespaceTag } from "./baseClasses";
import { ParseLineBreakTag, ParseSpacerTag, ParseWhitespaceTag } from "../parser/baseClasses";

export const schemaFromLineBreak = (item: ParseLineBreakTag): SchemaLineBreakTag => ({
    tag: 'br',
    parse: item
})

export const schemaFromSpacer = (item: ParseSpacerTag): SchemaSpacerTag => ({
    tag: 'Space',
    parse: item
})

export const schemaFromWhitespace = (item: ParseWhitespaceTag): SchemaWhitespaceTag => ({
    tag: 'Whitespace',
    parse: item
})
