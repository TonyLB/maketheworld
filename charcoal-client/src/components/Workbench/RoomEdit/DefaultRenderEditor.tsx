import React, { FunctionComponent } from 'react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import SituationFacetRenderFieldsEditor from '../foundations/SituationFacetRenderFieldsEditor'
import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'

export interface DefaultRenderEditorProps {
    roomId: ComponentUUID
}

/**
 * Edits the default situation render for a Room. Delegates to SituationFacetRenderFieldsEditor
 * with createOnEdit (render empty and create facet on first edit) and removeWhenEmpty
 * (remove facet when all fields are cleared).
 */
export const DefaultRenderEditor: FunctionComponent<DefaultRenderEditorProps> = ({ roomId }) => {
    return (
        <SituationFacetRenderFieldsEditor
            roomId={roomId}
            situationId={DEFAULT_SITUATION_ID}
            createOnEdit
            removeWhenEmpty
        />
    )
}

export default DefaultRenderEditor
