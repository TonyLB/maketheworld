import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { StandardEditableData, extractFromEditableData } from '@tonylb/mtw-base/ts/editable'
import type {
    ComponentExamplesMarkState,
    ComponentExamplesPayload,
    ComponentExamplesProvenance,
    ComponentExamplesRenderedContent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardMarkFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/mark'
import type { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import type { LensMarkWithDefault } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'

import type { AuthoredExample } from './result'

export type SituationFacetToCacheShapeOptions = {
    lensMarks?: LensMarkWithDefault[];
}

/**
 * Build cache-shaped payload from a Situation and its facet prose payload.
 *
 * When options.lensMarks is provided, limit marks to those defined on the lens and
 * use lens defaults for any mark not explicitly set on the situation.
 */
export function situationFacetToCacheShape(
    situation: StandardSituation,
    facetPayload: SituationProseFacetPayload,
    options?: SituationFacetToCacheShapeOptions
): ComponentExamplesPayload {
    const situationMarkValues = new Map<string, string>()
    situation.marks.items.forEach((facet) => {
        const markFacet = facet as StandardMarkFacet
        const mark = String(markFacet.reference.universalKey ?? '')
        const payload = markFacet.payload as { toJSON?: () => StandardEditableData<string> } | string
        let value = ''
        if (payload && typeof payload === 'object' && typeof payload.toJSON === 'function') {
            const editable = payload.toJSON() as StandardEditableData<string>
            const values = extractFromEditableData<string>(editable)
            value = values[0] ?? ''
        } else if (typeof payload === 'string') {
            value = payload
        }
        situationMarkValues.set(mark, value)
    })

    let markValue: ComponentExamplesMarkState['markValue']
    if (options && options.lensMarks) {
        markValue = options.lensMarks.map(({ markId, default: defaultValue }) => {
            const value = situationMarkValues.get(markId) ?? defaultValue ?? ''
            return { mark: markId, value }
        })
    } else {
        markValue = Array.from(situationMarkValues.entries()).map(([mark, value]) => ({
            mark,
            value,
        }))
    }
    const markState: ComponentExamplesMarkState = { markValue }

    const toRenderTree = (editable?: StandardEditableData<RenderTree>): RenderTree | undefined => {
        if (!editable) return undefined
        const trees = extractFromEditableData<RenderTree>(editable)
        return trees[0]
    }
    const displayName = facetPayload._displayName
        ? (extractFromEditableData<string>(
              facetPayload._displayName.toJSON() as StandardEditableData<string>
          ) as RenderTree)
        : undefined
    const summary = facetPayload._summary
        ? toRenderTree(facetPayload._summary.toJSON() as StandardEditableData<RenderTree>)
        : undefined
    const description =
        facetPayload._description != null
            ? (toRenderTree(facetPayload._description.toJSON() as StandardEditableData<RenderTree>) ?? [])
            : []

    const renderedContent: ComponentExamplesRenderedContent = {
        ...(displayName && (displayName as RenderTree).length ? { displayName } : {}),
        ...(summary ? { summary } : {}),
        description,
    }
    const provenance: ComponentExamplesProvenance = { type: 'authored' }
    return { markState, renderedContent, provenance }
}

export function authoredExampleFromSituationFacet(
    situationId: ComponentUUID,
    situation: StandardSituation,
    facetPayload: SituationProseFacetPayload,
    options?: SituationFacetToCacheShapeOptions
): AuthoredExample {
    const body = situationFacetToCacheShape(situation, facetPayload, options)
    return {
        situationId,
        ...body,
    }
}
