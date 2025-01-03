import { SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardMessageData = {
    tag: 'Message';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    rooms: GenericTree<SchemaTag>;
} & StandardBaseData

export const isStandardMessage = (arg: any): arg is StandardMessageData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Message'),
        checkTypes(arg, {
            key: 'string',
            rooms: 'tree'
        },
        {
            description: 'node'
        })
    )
}
