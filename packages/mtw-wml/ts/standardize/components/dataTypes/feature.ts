import { StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { FacetListData } from "../../keys/abstract";
import { isSituationProseFacetPayload, type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

/** Ephemera wire: prose from `<Render>`; same JSON shape as Situation prose facet payload. */
export type StandardFeatureRenderData = SituationProseFacetPayloadType

export type StandardFeatureData = {
    tag: 'Feature';
    shortName?: StandardEditableData<string>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Ephemera wire: resolved DisplayName / Summary / Description from `<Render>`. */
    render?: StandardFeatureRenderData;
} & StandardBaseData

const isStandardFeatureRenderData = (x: unknown): x is StandardFeatureRenderData => (
    typeof x === 'object'
    && x !== null
    && isSituationProseFacetPayload(x)
    && checkTypes(x as Record<string, unknown>, {}, {
        displayName: 'literal',
        summary: 'renderTree',
        description: 'renderTree',
    })
)

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
        }),
        !('render' in arg) ||
            isStandardFeatureRenderData(arg.render)
    )
}
