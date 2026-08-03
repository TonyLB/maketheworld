import { StandardBaseData } from './abstract'
import type { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { checkAll, checkTypes } from './typeguards'
import { FacetListData } from "../../keys/abstract";
import { isSituationProseFacetPayload, type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

/** Ephemera wire: prose from `<Render>`; same JSON shape as Situation prose facet payload. */
export type StandardObjectRenderData = SituationProseFacetPayloadType

export type StandardObjectData = {
    tag: 'Object';
    shortName?: StandardEditableData<string>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Ephemera wire: resolved DisplayName / Summary / Description from `<Render>`. */
    render?: StandardObjectRenderData;
} & StandardBaseData

const isStandardObjectRenderData = (x: unknown): x is StandardObjectRenderData => (
    typeof x === 'object'
    && x !== null
    && isSituationProseFacetPayload(x)
    && checkTypes(x as Record<string, unknown>, {}, {
        displayName: 'literal',
        summary: 'renderTree',
        description: 'renderTree',
    })
)

export const isStandardObjectData = (arg: any): arg is StandardObjectData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Object'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            situations: 'facetList',
        }),
        !('render' in arg) ||
            isStandardObjectRenderData(arg.render)
    )
}
