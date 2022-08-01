import { SchemaLineBreakTag, SchemaWhitespaceTag } from "./baseClasses";
import { ParseLineBreakTag, ParseWhitespaceTag } from "../parser/baseClasses";

export const schemaFromLineBreak = (item: ParseLineBreakTag): SchemaLineBreakTag => ({
    tag: 'br'
})

export const schemaFromWhitespace = (item: ParseWhitespaceTag): SchemaWhitespaceTag => ({
    tag: 'Whitespace'
})
