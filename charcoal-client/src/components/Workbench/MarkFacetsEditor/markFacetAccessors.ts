import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardGuidance from "@tonylb/mtw-wml/ts/standardize/components/guidance"
import StandardSituation from "@tonylb/mtw-wml/ts/standardize/components/situation"

import type { FacetListSessionAccessor } from "../foundations/FacetList/FacetListSessionEditor"

export function appendMarkFacetIfNew(
    marks: MarkFacetList,
    ref: StandardReference
): MarkFacetList | null {
    const universalKeyFromRef = ref.universalKey as ComponentUUID
    const already = marks.items.some(
        (f) => f.reference.universalKey === universalKeyFromRef
    )
    if (already) {
        return null
    }
    const newFacet = new StandardMarkFacet({
        reference: ref.toJSON(),
        payload: ""
    })
    return new MarkFacetList([...marks.items, newFacet])
}

export const guidanceMarkFacetAccessor: FacetListSessionAccessor<
    StandardGuidance,
    MarkFacetList,
    StandardMarkFacet
> = {
    getFacetList: (guidance) => guidance.marks,
    setFacetList: (guidance, list) => {
        guidance._payload._marks = list
    },
    appendReferenceIfNew: appendMarkFacetIfNew
}

export function associateMarkFacetOnDraft(
    componentId: ComponentUUID,
    ref: StandardReference,
    draft: StandardForm
): void {
    const base = draft.byUniversalId[componentId]
    if (!base || (!(base instanceof StandardGuidance) && !(base instanceof StandardSituation))) {
        return
    }
    const next = appendMarkFacetIfNew(base.marks, ref)
    if (next) {
        base._payload._marks = next
    }
}
