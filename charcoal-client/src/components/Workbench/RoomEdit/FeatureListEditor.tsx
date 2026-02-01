import React, { FunctionComponent, useCallback, useMemo } from "react"
import { Box } from "@mui/material"
import FeatureIcon from "@mui/icons-material/Search"

import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { ReferenceListEditor } from "../foundations/ReferenceList"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { useDispatch } from "react-redux"
import { navigateToComponent } from "../../../slices/UI/workbench"

type FeatureListEditorProps = {
    RoomId: ComponentUUID
}

export const FeatureListEditor: FunctionComponent<FeatureListEditorProps> = ({ RoomId }) => {
    const { standardForm, readonly } = useWorkbenchAsset()
    const dispatch = useDispatch()

    const room = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byUniversalId[RoomId]
            if (component && component instanceof StandardRoom) {
                return component
            }
        }
        return null
    }, [RoomId, standardForm])

    const listContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[RoomId]
            if (!(base instanceof StandardRoom)) return null
            return {
                referenceList: base._payload._features,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._features = list
                }
            }
        },
        [RoomId]
    )

    const handleItemClick = useCallback(
        (id: string) => {
            if (readonly) return
            dispatch(navigateToComponent(id as ComponentUUID))
        },
        [dispatch, readonly]
    )

    if (!room) {
        return (
            <Box sx={{ marginTop: "0.5em" }}>
                <ReferenceListEditor
                    title="Features"
                    listContext={listContext}
                    tag="Feature"
                    disabled={true}
                />
            </Box>
        )
    }

    return (
        <Box sx={{ marginTop: "0.5em" }}>
            <ReferenceListEditor
                title="Features"
                listContext={listContext}
                tag="Feature"
                affordance={{ enableReferenceExisting: true }}
                defaultExpanded={undefined}
                disabled={readonly}
                onItemClick={handleItemClick}
                icon={<FeatureIcon sx={{ fontSize: "1.1rem" }} />}
            />
        </Box>
    )
}

export default FeatureListEditor
