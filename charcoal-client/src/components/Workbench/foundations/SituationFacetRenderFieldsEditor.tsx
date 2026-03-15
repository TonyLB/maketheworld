import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { Box } from '@mui/material'
import { useDispatch } from 'react-redux'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import {
    SituationRoomFacetList,
    StandardSituationRoomFacet,
    SituationRoomFacetPayload
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRenderEditor from './StandardRender/StandardRenderEditor'
import { MakeTheWorldAccordion } from '../../UI'
import type { ScopedInstrumentationOptions } from '../../../testing/scopedInstrumentation'
import {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from '../../../slices/personalAssets'
import { fetchImports } from '../../../slices/personalAssets/index.api'

export interface SituationFacetRenderFieldsEditorProps {
    roomId: ComponentUUID
    situationId: ComponentUUID
    /** When true and an update would result in an empty payload, remove the facet instead of updating. */
    removeWhenEmpty?: boolean
    /**
     * When true and the room has no facet for this situation, render empty fields and create the facet
     * on first edit. Only applies when situationId is the default situation (SITUATION#DEFAULT).
     */
    createOnEdit?: boolean
}

/**
 * Edits the situation-facet render payload (displayName, summary, description) for a given
 * room and situation. Assumes the room has a situation facet for the given situationId;
 * returns null if the room or facet is missing. Uses useWorkbenchAsset() for standardForm,
 * updateStandard, and readonly. Intended for use in layered context (Room -> Situation) and
 * for future room-level default render editing with SITUATION#DEFAULT.
 */
export const SituationFacetRenderFieldsEditor: FunctionComponent<SituationFacetRenderFieldsEditorProps> = ({
    roomId,
    situationId,
    removeWhenEmpty = false,
    createOnEdit = false
}) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId } = useWorkbenchAsset()

    const room = useMemo(() => {
        const c = standardForm.byUniversalId[roomId]
        if (c && c instanceof StandardRoom) return c
        return undefined
    }, [roomId, standardForm])

    const facet = useMemo(() => {
        if (!room) return undefined
        return room.situations.items.find((f) => f.reference?.universalKey === situationId)
    }, [room, situationId])

    const updateFacetPayload = useCallback(
        (updatePayload: (prev: SituationRoomFacetPayload) => SituationRoomFacetPayload, options?: ScopedInstrumentationOptions) => {
            if (!room || !facet || readonly) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    const draftRoom = draft.byUniversalId[roomId]
                    if (!draftRoom || !(draftRoom instanceof StandardRoom)) return draft
                    const facetToUpdate = draftRoom.situations.items.find((f) => f.reference?.universalKey === situationId)
                    if (!facetToUpdate) return draft
                    const newPayload = updatePayload(facetToUpdate.payload as SituationRoomFacetPayload)
                    if (removeWhenEmpty && SituationRoomFacetPayload.isEmpty(newPayload)) {
                        const newItems = draftRoom.situations.items.filter(
                            (f) => f.reference?.universalKey !== situationId
                        )
                        draftRoom._payload._situations = new SituationRoomFacetList(newItems)
                        return draft
                    }
                    const newItems = draftRoom.situations.items.map((f) => {
                        if (f.reference?.universalKey !== situationId) return f
                        return new StandardSituationRoomFacet({
                            reference: f.reference ?? new StandardReference({ universalKey: situationId, tag: 'Situation' }),
                            payload: newPayload.toJSON()
                        })
                    })
                    draftRoom._payload._situations = new SituationRoomFacetList(newItems)
                    return draft
                }
            }, options)
        },
        [roomId, situationId, room, facet, updateStandard, readonly, removeWhenEmpty]
    )

    const ensureFacetWithPayload = useCallback(
        (payload: SituationRoomFacetPayload) => {
            if (!room || readonly || situationId !== DEFAULT_SITUATION_ID) return
            let needsFetch = false
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    needsFetch = assureDefaultSituationFromPrimitives(draft)
                    const draftRoom = draft.byUniversalId[roomId]
                    if (!draftRoom || !(draftRoom instanceof StandardRoom)) return draft
                    const existingIndex = draftRoom.situations.items.findIndex(
                        (f) => f.reference?.universalKey === situationId
                    )
                    const existingFacet = existingIndex >= 0 ? draftRoom.situations.items[existingIndex] : undefined
                    const existingJson =
                        existingFacet?.payload instanceof SituationRoomFacetPayload
                            ? existingFacet.payload.toJSON()
                            : (existingFacet?.payload as Record<string, unknown> | undefined)
                    const mergedPayload = existingJson
                        ? new SituationRoomFacetPayload({
                              displayName: payload._displayName?.toJSON() ?? existingJson.displayName,
                              summary: payload._summary?.toJSON() ?? existingJson.summary,
                              description: payload._description?.toJSON() ?? existingJson.description
                          })
                        : payload
                    const newFacet = new StandardSituationRoomFacet({
                        reference: new StandardReference({
                            universalKey: situationId,
                            tag: 'Situation'
                        }),
                        payload: mergedPayload.toJSON()
                    })
                    if (existingIndex >= 0) {
                        const newItems = draftRoom.situations.items.slice()
                        newItems[existingIndex] = newFacet
                        draftRoom._payload._situations = new SituationRoomFacetList(newItems)
                    } else {
                        draftRoom._payload._situations = new SituationRoomFacetList([
                            ...draftRoom.situations.items,
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
        [roomId, situationId, room, readonly, updateStandard, dispatch, AssetId]
    )

    const handleDisplayNameChange = useCallback(
        (newDisplayName: StandardRender) => {
            if (facet) {
                updateFacetPayload((prev) =>
                    new SituationRoomFacetPayload({
                        displayName: newDisplayName.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationRoomFacetPayload({
                    displayName: newDisplayName.toJSON(),
                    summary: undefined,
                    description: undefined
                })
                if (!SituationRoomFacetPayload.isEmpty(payload)) {
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
                    new SituationRoomFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: newSummary.toJSON(),
                        description: prev._description?.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationRoomFacetPayload({
                    displayName: undefined,
                    summary: newSummary.toJSON(),
                    description: undefined
                })
                if (!SituationRoomFacetPayload.isEmpty(payload)) {
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
                    new SituationRoomFacetPayload({
                        displayName: prev._displayName?.toJSON(),
                        summary: prev._summary?.toJSON(),
                        description: newDescription.toJSON()
                    })
                )
            } else if (createOnEdit && situationId === DEFAULT_SITUATION_ID) {
                const payload = new SituationRoomFacetPayload({
                    displayName: undefined,
                    summary: undefined,
                    description: newDescription.toJSON()
                })
                if (!SituationRoomFacetPayload.isEmpty(payload)) {
                    ensureFacetWithPayload(payload)
                }
            }
        },
        [facet, createOnEdit, situationId, updateFacetPayload, ensureFacetWithPayload]
    )

    const canRenderEmpty = createOnEdit && situationId === DEFAULT_SITUATION_ID
    if (!room || (!facet && !canRenderEmpty)) return null

    const emptyRender = new StandardRender([])
    const payload = facet ? (facet.payload as SituationRoomFacetPayload) : undefined

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MakeTheWorldAccordion title="Appearance" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <StandardRenderEditor
                        title="Display Name"
                        value={payload?._displayName ?? emptyRender}
                        onChange={handleDisplayNameChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Display Name"
                        tag="DisplayName"
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
