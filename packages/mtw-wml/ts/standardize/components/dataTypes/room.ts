import { StandardReferenceData } from "./reference";
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { StandardExitData } from "../exit";

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits: StandardEditableData<StandardExitData>[];
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
            shortName: 'literal',
            examples: 'referenceList'
        })
    )
}