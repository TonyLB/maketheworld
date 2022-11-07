import { SchemaBookmarkTag, SchemaTaggedMessageIncomingContents } from "./baseClasses";
import { ParseBookmarkTag } from "../parser/baseClasses";
import { translateTaggedMessageContents } from "./taggedMessage";

export const schemaFromBookmark = (item: ParseBookmarkTag, contents: SchemaTaggedMessageIncomingContents[]): SchemaBookmarkTag => {
    return {
        tag: 'Bookmark',
        key: item.key,
        display: item.display,
        contents: translateTaggedMessageContents(contents),
        parse: item
    }
}

export default schemaFromBookmark
