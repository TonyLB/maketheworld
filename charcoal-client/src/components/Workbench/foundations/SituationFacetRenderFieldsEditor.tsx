import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { Box } from '@mui/material'
import { useDispatch } from 'react-redux'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import {
    SituationProseFacetList,
    StandardSituationProseFacet,
    SituationProseFacetPayload
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRenderEditor from './StandardRender/StandardRenderEditor'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { TopLevelStandardLiteralEditor } from './StandardLiteral'
import { MakeTheWorldAccordion } from '../../UI'
import type { ScopedInstrumentationOptions } from '../../../testing/scopedInstrumentation'
import {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from '../../../slices/personalAssets'
import { fetchImports } from '../../../slices/personalAssets/index.api'

export type SituationProseParent = StandardRoom | StandardFeature | StandardKnowledge

export function isSituationProseParent(component: unknown): component is SituationProseParent {
    return (
        component instanceof StandardRoom ||
        component instanceof StandardFeature ||
        component instanceof StandardKnowledge
    )
}

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
 * Edits the situation-facet render payload (displayName, summary, description) for a given
 * parent (Room, Feature, or Knowledge) and situation. Returns null if the parent or facet is
 * missing (unless createOnEdit with DEFAULT situation). Uses useWorkbenchAsset() for standardForm,
 * updateStandard, and readonly.
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
        return parent.situations.items.find((f) => f.reference?.universalKey === situationId)
    }, [parent, situationId])

    const updateFacetPayload = useCallback(
        (updatePayload: (prev: SituationProseFacetPayload) => SituationProseFacetPayload, options?: ScopedInstrumentationOptions) => {
            if (!parent || !facet || readonly) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    const draftParent = draft.byUniversalId[parentId]
                    if (!isSituationProseParent(draftParent)) return draft
                    const facetToUpdate = draftParent.situations.items.find((f) => f.reference?.universalKey === situationId)
                    if (!facetToUpdate) return draft
                    const newPayload = updatePayload(facetToUpdate.payload as SituationProseFacetPayload)
                    if (removeWhenEmpty && SituationProseFacetPayload.isEmpty(newPayload)) {
                        const newItems = draftParent.situations.items.filter(
                            (f) => f.reference?.universalKey !== situationId
                        )
                        draftParent._payload._situations = new SituationProseFacetList(newItems)
                        return draft
                    }
                    const newItems = draftParent.situations.items.map((f) => {
                        if (f.reference?.universalKey !== situationId) return f
                        return new StandardSituationProseFacet({
                            reference: f.reference ?? new StandardReference({ universalKey: situationId, tag: 'Situation' }),
                            payload: newPayload.toJSON()
                        })
                    })
                    draftParent._payload._situations = new SituationProseFacetList(newItems)
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
                    const existingIndex = draftParent.situations.items.findIndex(
                        (f) => f.reference?.universalKey === situationId
                    )
                    const existingFacet = existingIndex >= 0 ? draftParent.situations.items[existingIndex] : undefined
                    const existingJson =
                        existingFacet?.payload instanceof SituationProseFacetPayload
                            ? existingFacet.payload.toJSON()
                            : (existingFacet?.payload as Record<string, unknown> | undefined)
                    const mergedPayload = existingJson
                        ? new SituationProseFacetPayload({
                              displayName: payload._displayName?.toJSON() ?? existingJson.displayName,
                              summary: payload._summary?.toJSON() ?? existingJson.summary,
                              description: payload._description?.toJSON() ?? existingJson.description
                          })
                        : payload
                    const newFacet = new StandardSituationProseFacet({
                        reference: new StandardReference({
                            universalKey: situationId,
                            tag: 'Situation'
                        }),
                        payload: mergedPayload.toJSON()
                    })
                    if (existingIndex >= 0) {
                        const newItems = draftParent.situations.items.slice()
                        newItems[existingIndex] = newFacet
                        draftParent._payload._situations = new SituationProseFacetList(newItems)
                    } else {
                        draftParent._payload._situations = new SituationProseFacetList([
                            ...draftParent.situations.items,
                            newFacet
                        ])
                    }
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

    const emptyRender = new StandardRender([])
    const payload = facet ? (facet.payload as SituationProseFacetPayload) : undefined

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MakeTheWorldAccordion title="Appearance" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <TopLevelStandardLiteralEditor
                        value={payload?._displayName ?? new StandardLiteral('')}
                        onChange={handleDisplayNameChange}
                        label="Display Name"
                        placeholder="Enter a Display Name"
                        size="small"
                        readonly={readonly}
                    />
                    <StandardRenderEditor
                        title="Summary"
                        value={payload?._summary ?? emptyRender}
                        onChange={handleSummaryChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Summary"
                        tag="Summary"
                    />
                    <StandardRenderEditor
                        title="Description"
                        value={payload?._description ?? emptyRender}
                        onChange={handleDescriptionChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Description"
                        tag="Description"
                    />
                </Box>
            </MakeTheWorldAccordion>
        </Box>
    )
}

export default SituationFacetRenderFieldsEditor
