import React, { FunctionComponent, useCallback, useMemo } from 'react'

import { SituationProseFacetPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'
import {
    ensureSituationFacetWithPayloadOnParent,
    findSituationFacet,
    isSituationProseParent,
    type SituationProseParent,
    updateSituationFacetPayloadOnParent
} from './workbenchMutations'
import SituationFacetRenderFieldsView from './SituationFacetRenderFieldsView'
import { useWorkbenchComponent } from './WorkbenchComponent'

/**
 * Context-only DEFAULT situation facet prose; requires WorkbenchComponentProvider.
 */
export const DefaultRenderEditor: FunctionComponent = () => {
    const { working, updateComponent, readonly: sessionReadonly, missing } =
        useWorkbenchComponent<SituationProseParent>()

    const facet = useMemo(() => {
        if (!working || !isSituationProseParent(working)) {
            return undefined
        }
        return findSituationFacet(working, DEFAULT_SITUATION_ID)
    }, [working])

    const payload = facet ? (facet.payload as SituationProseFacetPayload) : undefined

    const applyPayloadUpdate = useCallback(
        (updatePayload: (prev: SituationProseFacetPayload) => SituationProseFacetPayload) => {
            if (sessionReadonly || !working || !isSituationProseParent(working)) {
                return
            }
            updateComponent((draft) => {
                if (!isSituationProseParent(draft)) {
                    return
                }
                if (findSituationFacet(draft, DEFAULT_SITUATION_ID)) {
                    updateSituationFacetPayloadOnParent(draft, DEFAULT_SITUATION_ID, updatePayload, {
                        removeWhenEmpty: true
                    })
                }
            })
        },
        [sessionReadonly, working, updateComponent]
    )

    const ensureFacetWithPayload = useCallback(
        (newPayload: SituationProseFacetPayload) => {
            if (sessionReadonly || !working || !isSituationProseParent(working)) {
                return
            }
            if (SituationProseFacetPayload.isEmpty(newPayload)) {
                return
            }
            updateComponent((draft) => {
                if (!isSituationProseParent(draft)) {
                    return
                }
                ensureSituationFacetWithPayloadOnParent(draft, DEFAULT_SITUATION_ID, newPayload)
            })
        },
        [sessionReadonly, working, updateComponent]
    )

    const handleDisplayNameChange = useCallback(
        (newDisplayName: StandardLiteral) => {
            if (facet) {
                applyPayloadUpdate((prev) =>
                    new SituationProseFacetPayload({
                        displayName: newDisplayName.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else {
                const newPayload = new SituationProseFacetPayload({
                    displayName: newDisplayName.toJSON(),
                    summary: undefined,
                    description: undefined
                })
                ensureFacetWithPayload(newPayload)
            }
        },
        [facet, applyPayloadUpdate, ensureFacetWithPayload]
    )

    const handleSummaryChange = useCallback(
        (newSummary: StandardRender) => {
            if (facet) {
                applyPayloadUpdate((prev) =>
                    new SituationProseFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: newSummary.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else {
                const newPayload = new SituationProseFacetPayload({
                    displayName: undefined,
                    summary: newSummary.toJSON(),
                    description: undefined
                })
                ensureFacetWithPayload(newPayload)
            }
        },
        [facet, applyPayloadUpdate, ensureFacetWithPayload]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            if (facet) {
                applyPayloadUpdate((prev) =>
                    new SituationProseFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: newDescription.toJSON()
                    })
                )
            } else {
                const newPayload = new SituationProseFacetPayload({
                    displayName: undefined,
                    summary: undefined,
                    description: newDescription.toJSON()
                })
                ensureFacetWithPayload(newPayload)
            }
        },
        [facet, applyPayloadUpdate, ensureFacetWithPayload]
    )

    if (missing || !working || !isSituationProseParent(working)) {
        return null
    }

    return (
        <SituationFacetRenderFieldsView
            payload={payload}
            readonly={sessionReadonly}
            debounce={false}
            onDisplayNameChange={handleDisplayNameChange}
            onSummaryChange={handleSummaryChange}
            onDescriptionChange={handleDescriptionChange}
        />
    )
}

export default DefaultRenderEditor
