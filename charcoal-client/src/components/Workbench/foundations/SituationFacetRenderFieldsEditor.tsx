import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    SituationProseFacetPayload
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

import {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from '../../../slices/personalAssets'
import { fetchImports } from '../../../slices/personalAssets/index.api'
import type { ScopedInstrumentationOptions } from '../../../testing/scopedInstrumentation'
import {
    ensureSituationFacetWithPayloadOnParent,
    findSituationFacet,
    isSituationProseParent,
    updateSituationFacetPayloadOnParent
} from './workbenchMutations'
import SituationFacetRenderFieldsView from './SituationFacetRenderFieldsView'
import { useWorkbenchAsset } from './useWorkbenchAsset'

export interface SituationFacetRenderFieldsEditorProps {
    parentId: ComponentUUID
    situationId: ComponentUUID
    /** When true and an update would result in an empty payload, remove the facet instead of updating. */
    removeWhenEmpty?: boolean
    /**
     * When true and the parent has no facet for this situation, render empty fields and create the facet
     * on first edit. Only applies when situationId is the default situation (SITUATION#DEFAULT).
     */
    createOnEdit?: boolean
}

/**
 * Asset-mode editor for situation-facet render payload (displayName, summary, description).
 * Reads from Redux standardForm and persists via updateStandard. Used by layered Room
 * situation views (SituationFacetPayloadEditor). For inline DEFAULT prose on provider
 * screens, use DefaultRenderEditor instead.
 */
export const SituationFacetRenderFieldsEditor: FunctionComponent<SituationFacetRenderFieldsEditorProps> = ({
    parentId,
    situationId,
    removeWhenEmpty = false,
    createOnEdit = false
}) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId } = useWorkbenchAsset()

    const parent = useMemo(() => {
        const c = standardForm.byUniversalId[parentId]
        if (isSituationProseParent(c)) return c
        return undefined
    }, [parentId, standardForm])

    const facet = useMemo(() => {
        if (!parent) return undefined
        return findSituationFacet(parent, situationId)
    }, [parent, situationId])

    const updateFacetPayload = useCallback(
        (updatePayload: (prev: SituationProseFacetPayload) => SituationProseFacetPayload, options?: ScopedInstrumentationOptions) => {
            if (!parent || !facet || readonly) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    const draftParent = draft.byUniversalId[parentId]
                    if (!isSituationProseParent(draftParent)) return draft
                    updateSituationFacetPayloadOnParent(draftParent, situationId, updatePayload, {
                        removeWhenEmpty
                    })
                    return draft
                }
            }, options)
        },
        [parentId, situationId, parent, facet, updateStandard, readonly, removeWhenEmpty]
    )

    const ensureFacetWithPayload = useCallback(
        (payload: SituationProseFacetPayload) => {
            if (!parent || readonly || situationId !== DEFAULT_SITUATION_ID) return
            let needsFetch = false
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    needsFetch = assureDefaultSituationFromPrimitives(draft)
                    const draftParent = draft.byUniversalId[parentId]
                    if (!isSituationProseParent(draftParent)) return draft
                    ensureSituationFacetWithPayloadOnParent(draftParent, situationId, payload)
                    return draft
                }
            })
            if (needsFetch) {
                dispatch(fetchImports(AssetId))
            }
        },
        [parentId, situationId, parent, readonly, updateStandard, dispatch, AssetId]
    )

    const handleDisplayNameChange = useCallback(
        (newDisplayName: StandardLiteral) => {
            if (facet) {
                updateFacetPayload((prev) =>
                    new SituationProseFacetPayload({
                        displayName: newDisplayName.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationProseFacetPayload({
                    displayName: newDisplayName.toJSON(),
                    summary: undefined,
                    description: undefined
                })
                if (!SituationProseFacetPayload.isEmpty(payload)) {
                    ensureFacetWithPayload(payload)
                }
            }
        },
        [facet, createOnEdit, situationId, updateFacetPayload, ensureFacetWithPayload]
    )

    const handleSummaryChange = useCallback(
        (newSummary: StandardRender) => {
            if (facet) {
                updateFacetPayload((prev) =>
                    new SituationProseFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: newSummary.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationProseFacetPayload({
                    displayName: undefined,
                    summary: newSummary.toJSON(),
                    description: undefined
                })
                if (!SituationProseFacetPayload.isEmpty(payload)) {
                    ensureFacetWithPayload(payload)
                }
            }
        },
        [facet, createOnEdit, situationId, updateFacetPayload, ensureFacetWithPayload]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            if (facet) {
                updateFacetPayload((prev) =>
                    new SituationProseFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: newDescription.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationProseFacetPayload({
                    displayName: undefined,
                    summary: undefined,
                    description: newDescription.toJSON()
                })
                if (!SituationProseFacetPayload.isEmpty(payload)) {
                    ensureFacetWithPayload(payload)
                }
            }
        },
        [facet, createOnEdit, situationId, updateFacetPayload, ensureFacetWithPayload]
    )

    const canRenderEmpty = createOnEdit && situationId === DEFAULT_SITUATION_ID
    if (!parent || (!facet && !canRenderEmpty)) return null

    const payload = facet ? (facet.payload as SituationProseFacetPayload) : undefined

    return (
        <SituationFacetRenderFieldsView
            payload={payload}
            readonly={readonly}
            onDisplayNameChange={handleDisplayNameChange}
            onSummaryChange={handleSummaryChange}
            onDescriptionChange={handleDescriptionChange}
        />
    )
}

export default SituationFacetRenderFieldsEditor

export type { SituationProseParent } from './workbenchMutations'
export { isSituationProseParent } from './workbenchMutations'
