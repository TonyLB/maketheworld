import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData, FacetListInputData } from "../../keys/abstract"
import type { LensMarkFacetPayloadType } from "../../keys/facets/dataTypes/facet"
import { Override } from "../../types"

export type StandardLensData = {
    tag: 'Lens';
    shortName?: StandardEditableData<string>;
    description?: StandardEditableData<RenderTree>;
    marks?: FacetListData<LensMarkFacetPayloadType>;
} & StandardBaseData

export type StandardLensInputData = Override<StandardLensData, {
    marks?: FacetListInputData<LensMarkFacetPayloadType>;
}>

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

export const isStandardLensInputData = (arg: any): arg is StandardLensInputData => {
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
            marks: 'facetListInput'
        })
    )
}
