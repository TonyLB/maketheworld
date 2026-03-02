import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Box } from '@mui/material'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { getCurrentComponentId, getCurrentComponentLayerId } from '../../../slices/UI/workbench'
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
import StandardRenderEditor from '../foundations/StandardRender/StandardRenderEditor'
import { MakeTheWorldAccordion } from '../../UI'

/**
 * Edits the situation-facet payload (displayName, summary, description) for one Situation
 * on the current Room. Used in layered context when stack is [RoomId, SituationId].
 */
export const SituationFacetPayloadEditor: FunctionComponent = () => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const roomId = useSelector(getCurrentComponentId) as ComponentUUID | null
    const situationId = useSelector(getCurrentComponentLayerId) as ComponentUUID | null

    const room = useMemo(() => {
        if (!roomId) return undefined
        const c = standardForm.byUniversalId[roomId]
        if (c && c instanceof StandardRoom) return c
        return undefined
    }, [roomId, standardForm])

    const facet = useMemo(() => {
        if (!room || !situationId) return undefined
        return room.situations.items.find((f) => f.reference?.universalKey === situationId)
    }, [room, situationId])

    const updateFacetPayload = useCallback(
        (updatePayload: (prev: SituationRoomFacetPayload) => SituationRoomFacetPayload) => {
            if (!roomId || !situationId || !room || !facet || readonly) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm): StandardForm => {
                    const draftRoom = draft.byUniversalId[roomId]
                    if (!draftRoom || !(draftRoom instanceof StandardRoom)) return draft
                    const newItems = draftRoom.situations.items.map((f) => {
                        if (f.reference?.universalKey !== situationId) return f
                        const newPayload = updatePayload(f.payload as SituationRoomFacetPayload)
                        return new StandardSituationRoomFacet({
                            reference: f.reference ?? new StandardReference({ universalKey: situationId, tag: 'Situation' }),
                            payload: newPayload.toJSON()
                        })
                    })
                    draftRoom._payload._situations = new SituationRoomFacetList(newItems)
                    return draft
                }
            })
        },
        [roomId, situationId, room, facet, updateStandard, readonly]
    )

    const handleDisplayNameChange = useCallback(
        (newDisplayName: StandardRender) => {
            updateFacetPayload((prev) =>
                new SituationRoomFacetPayload({
                    displayName: newDisplayName.toJSON(),
                    summary: prev._summary?.toJSON(),
                    description: prev._description?.toJSON()
                })
            )
        },
        [updateFacetPayload]
    )

    const handleSummaryChange = useCallback(
        (newSummary: StandardRender) => {
            updateFacetPayload((prev) =>
                new SituationRoomFacetPayload({
                    displayName: prev._displayName?.toJSON(),
                    summary: newSummary.toJSON(),
                    description: prev._description?.toJSON()
                })
            )
        },
        [updateFacetPayload]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            updateFacetPayload((prev) =>
                new SituationRoomFacetPayload({
                    displayName: prev._displayName?.toJSON(),
                    summary: prev._summary?.toJSON(),
                    description: newDescription.toJSON()
                })
            )
        },
        [updateFacetPayload]
    )

    if (!room || !facet) return null

    const payload = facet.payload as SituationRoomFacetPayload

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MakeTheWorldAccordion title="Appearance" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <StandardRenderEditor
                        title="Display Name"
                        value={payload._displayName ?? new StandardRender([])}
                        onChange={handleDisplayNameChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Display Name"
                        tag="DisplayName"
                    />
                    <StandardRenderEditor
                        title="Summary"
                        value={payload._summary ?? new StandardRender([])}
                        onChange={handleSummaryChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Summary"
                        tag="Summary"
                    />
                    <StandardRenderEditor
                        title="Description"
                        value={payload._description ?? new StandardRender([])}
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

export default SituationFacetPayloadEditor
