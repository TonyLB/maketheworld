import { StandardLens } from '../components/worldState'
import { LensMarkFacetList, LensMarkFacetPayload, StandardLensMarkFacet } from '../keys'
import { StandardEditableData, extractFromEditableData } from '@tonylb/mtw-base/ts/editable'

export type LensMarkWithDefault = {
    markId: string;
    default: string;
}

/**
 * Extract Lens-controlled mark defaults as simple string values.
 *
 * This helper understands how Lens mark facets and StandardLiteral / StandardEditableData
 * interact, but is agnostic about any particular lambda or storage layer.
 */
export const getLensMarksWithDefaults = (lens: StandardLens): LensMarkWithDefault[] => {
    if (!lens.marks || !(lens.marks instanceof LensMarkFacetList)) {
        return []
    }
    return lens.marks.items.map((facet) => {
        const lensFacet = facet as StandardLensMarkFacet
        const markId = String(lensFacet.reference.universalKey ?? '')
        const payload = lensFacet.payload as unknown as LensMarkFacetPayload
        let defaultValue = ''
        const literal = payload.default
        if (literal && typeof (literal as any).toJSON === 'function') {
            const editable = (literal as any).toJSON() as StandardEditableData<string>
            const values = extractFromEditableData<string>(editable)
            defaultValue = values[0] ?? ''
        }
        return {
            markId,
            default: defaultValue,
        }
    })
}

