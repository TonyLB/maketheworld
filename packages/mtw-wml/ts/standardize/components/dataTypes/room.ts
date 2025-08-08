import { StandardReferenceData } from "./reference";
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { isStandardExitData, StandardExitData } from "../exit";
import { is } from "immer/dist/internal";

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits: StandardEditableData<StandardExitData>[];
    features?: StandardEditableData<StandardReferenceData>[];
    examples?: StandardEditableData<StandardReferenceData>[];
    characters?: StandardEditableData<StandardReferenceData>[];
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