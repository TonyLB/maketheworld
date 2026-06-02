import React, { FunctionComponent, useCallback } from "react"
import { Box } from "@mui/material"
import FeatureIcon from "@mui/icons-material/Search"

import { ReferenceListSessionEditor } from '../foundations/ReferenceList'
import { roomFeaturesListAccessor } from './roomReferenceListAccessors'
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { useDispatch } from "react-redux"
import { navigateToComponent } from "../../../slices/UI/workbench"
import { useWorkbenchComponent } from "../foundations/WorkbenchComponent"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"

type FeatureListEditorProps = {
    RoomId: ComponentUUID
}

export const FeatureListEditor: FunctionComponent<FeatureListEditorProps> = ({ RoomId: _RoomId }) => {
    const dispatch = useDispatch()
    const { readonly, missing } = useWorkbenchComponent<StandardRoom>()

    const handleItemClick = useCallback(
        (id: string) => {
            if (readonly) return
            dispatch(navigateToComponent(id as ComponentUUID))
        },
        [dispatch, readonly]
    )

    if (missing) {
        return null
    }

    return (
        <Box sx={{ marginTop: "0.5em" }}>
            <ReferenceListSessionEditor
                title="Features"
                listAccessor={roomFeaturesListAccessor}
                tag="Feature"
                affordance={{ enableReferenceExisting: true }}
                disabled={readonly}
                onItemClick={handleItemClick}
                icon={<FeatureIcon sx={{ fontSize: "1.1rem" }} />}
            />
        </Box>
    )
}

export default FeatureListEditor
