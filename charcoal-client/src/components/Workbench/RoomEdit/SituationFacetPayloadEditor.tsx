import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { getCurrentComponentId, getCurrentComponentLayerId } from '../../../slices/UI/workbench'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import SituationFacetRenderFieldsEditor from '../foundations/SituationFacetRenderFieldsEditor'

/**
 * Layered-context entry point for editing a situation facet's render payload. Reads roomId
 * and situationId from the workbench breadcrumb stack and delegates to SituationFacetRenderFieldsEditor.
 * Used when stack is [RoomId, SituationId].
 */
export const SituationFacetPayloadEditor: FunctionComponent = () => {
    const roomId = useSelector(getCurrentComponentId) as ComponentUUID | null
    const situationId = useSelector(getCurrentComponentLayerId) as ComponentUUID | null

    if (roomId === null || situationId === null) return null

    return <SituationFacetRenderFieldsEditor parentId={roomId} situationId={situationId} />
}

export default SituationFacetPayloadEditor
