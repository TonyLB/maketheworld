import { SchemaDescriptionTag, SchemaTaggedMessageLegalContents, SchemaLinkTag, SchemaStringTag, SchemaTaggedMessageIncomingContents, isSchemaWhitespace, isSchemaLineBreak, isSchemaLink, isSchemaString, isSchemaSpacer } from "./baseClasses";
import { ParseDescriptionTag } from "../parser/baseClasses";
import { translateTaggedMessageContents } from "./taggedMessage";

export const schemaFromDescription = (item: ParseDescriptionTag, contents: SchemaTaggedMessageIncomingContents[]): SchemaDescriptionTag => {
    return {
        tag: 'Description',
        display: item.display,
        contents: translateTaggedMessageContents(contents),
        parse: item
    }
}

export default schemaFromDescription
