import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData } from "../../keys/abstract"
import type { LensMarkFacetPayloadType } from "../../keys/facets/dataTypes/facet"

export type StandardLensData = {
    tag: 'Lens';
    shortName?: StandardEditableData<string>;
    description?: StandardEditableData<RenderTree>;
    marks?: FacetListData<LensMarkFacetPayloadType>;
} & StandardBaseData

export const isStandardLensData = (arg: any): arg is StandardLensData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Lens'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            description: 'renderTree',
            marks: 'facetList'
        })
    )
}
