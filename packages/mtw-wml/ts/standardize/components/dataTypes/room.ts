import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData } from "../../keys/abstract"
import { ExitPayload } from "../../keys/facets/dataTypes/facet"

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits?: FacetListData<ExitPayload>;
    lenses?: ReferenceListData;
    features?: ReferenceListData;
    examples?: ReferenceListData;
    characters?: ReferenceListData;
} & StandardBaseData

export const isStandardRoomData = (arg: any): arg is StandardRoomData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        checkTypes(arg, { },
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            exits: 'facetList',
            lenses: 'referenceList',
            examples: 'referenceList',
            characters: 'referenceList'
        })
    )
}