import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { FacetListData } from "../../keys/abstract";
import { isSituationProseFacetPayload, type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

/** Ephemera wire: prose from `<Render>`; same JSON shape as Situation prose facet payload. */
export type StandardKnowledgeRenderData = SituationProseFacetPayloadType

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    shortName?: StandardEditableData<string>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Ephemera wire: resolved DisplayName / Summary / Description from `<Render>`. */
    render?: StandardKnowledgeRenderData;
} & StandardBaseData

const isStandardKnowledgeRenderData = (x: unknown): x is StandardKnowledgeRenderData => (
    typeof x === 'object'
    && x !== null
    && isSituationProseFacetPayload(x)
    && checkTypes(x as Record<string, unknown>, {}, {
        displayName: 'literal',
        summary: 'renderTree',
        description: 'renderTree',
    })
)

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
        }),
        !('render' in arg) ||
            isStandardKnowledgeRenderData(arg.render)
    )
}
