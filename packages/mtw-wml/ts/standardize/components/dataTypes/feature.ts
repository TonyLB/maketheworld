import { StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { FacetListData } from "../../keys/abstract";
import { type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

export type StandardFeatureData = {
    tag: 'Feature';
    shortName?: StandardEditableData<string>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
} & StandardBaseData

export const isStandardFeatureData = (arg: any): arg is StandardFeatureData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Feature'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            situations: 'facetList',
        })
    )
}
