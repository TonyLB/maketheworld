import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import {
    LensMarkFacetList,
    StandardLensMarkFacet
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"

import type { FacetListSessionAccessor } from "../../foundations/FacetList/FacetListSessionEditor"

export function appendLensMarkFacetIfNew(
    marks: LensMarkFacetList,
    ref: StandardReference
): LensMarkFacetList | null {
    const universalKeyFromRef = ref.universalKey as ComponentUUID
    const already = marks.items.some(
        (f) => f.reference.universalKey === universalKeyFromRef
    )
    if (already) {
        return null
    }
    const newFacet = new StandardLensMarkFacet({
        reference: ref.toJSON(),
        payload: {}
    })
    return new LensMarkFacetList([...marks.items, newFacet])
}

export const lensMarkFacetAccessor: FacetListSessionAccessor<
    StandardLens,
    LensMarkFacetList,
    StandardLensMarkFacet
> = {
    getFacetList: (lens) => lens.marks,
    setFacetList: (lens, list) => {
        lens._payload._marks = list
    },
    appendReferenceIfNew: appendLensMarkFacetIfNew
}
