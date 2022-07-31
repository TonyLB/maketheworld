import { SchemaLinkTag, SchemaStringTag } from "../baseClasses";
import { ParseLinkTag } from "../parser/baseClasses";

export const schemaFromLink = (item: ParseLinkTag, contents: SchemaStringTag[]): SchemaLinkTag => ({
    tag: 'Link',
    to: item.to,
    text: contents.map(({ value }) => (value)).join('')
})

export default schemaFromLink
