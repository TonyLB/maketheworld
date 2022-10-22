import { SchemaNameTag, SchemaTaggedMessageIncomingContents } from "./baseClasses";
import { ParseNameTag } from "../parser/baseClasses";
import { translateTaggedMessageContents } from "./taggedMessage";

export const schemaFromName = (item: ParseNameTag, contents: SchemaTaggedMessageIncomingContents[]): SchemaNameTag => {
    return {
        tag: 'Name',
        parse: item,
        contents: translateTaggedMessageContents(contents),
    }
}

export default schemaFromName
