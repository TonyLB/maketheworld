import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData } from "../../keys/abstract"
import { ExitPayload } from "../../keys/facets/dataTypes/facet"
import type { SituationRoomFacetPayloadType } from "../../keys/facets/situationRoom"

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits?: FacetListData<ExitPayload>;
    situations?: FacetListData<SituationRoomFacetPayloadType>;
    lenses?: ReferenceListData;
    features?: ReferenceListData;
    examples?: ReferenceListData;
    guidance?: ReferenceListData;
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
            situations: 'facetList',
            lenses: 'referenceList',
            features: 'referenceList',
            examples: 'referenceList',
            guidance: 'referenceList',
            characters: 'referenceList'
        })
    )
}