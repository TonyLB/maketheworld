import { StandardReferenceData } from "./reference";
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";

export type StandardRoomData = {
    tag: 'Room';
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    features?: (StandardReferenceData | StandardRemoveData)[];
    examples?: (StandardReferenceData | StandardRemoveData)[];
} & StandardBaseData

export const isStandardRoom = (arg: any): arg is StandardRoomData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        checkTypes(arg, {
            key: 'string',
            exits: 'tree'
        },
        {
            shortName: 'node',
        })
    )
}