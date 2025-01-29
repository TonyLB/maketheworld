import { StandardReferenceData } from "./reference";
import { GenericTree, GenericTreeFiltered } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components";
import { SchemaOutputTag, SchemaTag, SchemaThemeTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";

export type StandardRoomData = {
    tag: 'Room';
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
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
            exits: 'tree',
            themes: 'tree'
        },
        {
            shortName: 'node',
        })
    )
}