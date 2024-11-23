import { SchemaDescriptionTag, SchemaOutputTag } from "../../../schema/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardBookmarkData = {
    tag: 'Bookmark';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBaseData

export const isStandardBookmark = (arg: any): arg is StandardBookmarkData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Bookmark'),
        checkTypes(arg, {
            key: 'string'
        },
        {
            description: 'node'
        })
    )
}