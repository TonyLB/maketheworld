import { SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";

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