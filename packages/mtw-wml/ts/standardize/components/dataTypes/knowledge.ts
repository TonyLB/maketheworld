import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { FacetListData } from "../../keys/abstract";
import { type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    shortName?: StandardEditableData<string>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
} & StandardBaseData

export const isStandardKnowledgeData = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {}, { 
            key: 'key', 
            universalKey: 'string',
            shortName: 'literal',
            situations: 'facetList',
        })
    )
}
