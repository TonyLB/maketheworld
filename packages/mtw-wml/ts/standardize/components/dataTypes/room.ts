import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isStandardExitData, StandardExitData } from "../exit"

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits?: StandardEditableData<StandardExitData>[];
    features?: ReferenceListData;
    examples?: ReferenceListData;
    characters?: ReferenceListData;
} & StandardBaseData

export const isStandardRoom = (arg: any): arg is StandardRoomData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        (!('exits' in arg) || (Array.isArray(arg.exits) && arg.exits.every(isStandardExitData))),
        checkTypes(arg, { },
        {
            key: 'string',
            universalKey: 'string',
            shortName: 'literal',
            examples: 'referenceList',
            characters: 'referenceList'
        })
    )
}