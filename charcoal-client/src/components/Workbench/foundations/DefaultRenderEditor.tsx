import React, { FunctionComponent } from 'react'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import SituationFacetRenderFieldsEditor from './SituationFacetRenderFieldsEditor'
import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'

export interface DefaultRenderEditorProps {
    parentId: ComponentUUID
}

/**
 * Edits the default situation render for a Room, Feature, or Knowledge parent.
 * Delegates to SituationFacetRenderFieldsEditor with createOnEdit (render empty and create
 * facet on first edit) and removeWhenEmpty (remove facet when all fields are cleared).
 */
export const DefaultRenderEditor: FunctionComponent<DefaultRenderEditorProps> = ({ parentId }) => {
    return (
        <SituationFacetRenderFieldsEditor
            parentId={parentId}
            situationId={DEFAULT_SITUATION_ID}
            createOnEdit
            removeWhenEmpty
        />
    )
}

export default DefaultRenderEditor
