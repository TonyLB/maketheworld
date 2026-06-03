import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useSelector } from "react-redux"
import Box from "@mui/material/Box"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { defaultedEquals } from "@tonylb/mtw-wml/ts/standardize/components/utils"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardRenderEditor } from "../foundations/StandardRender"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { getCurrentComponentId } from "../../../slices/UI/workbench"
import {
    WorkbenchComponentProvider,
    useWorkbenchComponent
} from "../foundations/WorkbenchComponent"
import { MarkInlineEditor } from "./InlineEditor"

const markGuard = (
    component: StandardComponent | undefined
): component is StandardMark => component instanceof StandardMark

export const MarkEditorBody: FunctionComponent = () => {
    const { working, updateComponent } = useWorkbenchComponent<StandardMark>()

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            updateComponent((draft) => {
                if (defaultedEquals(draft.description, newDescription)) {
                    return
                }
                draft._payload._description = newDescription.isEmpty()
                    ? undefined
                    : newDescription
            })
        },
        [updateComponent]
    )

    if (!working) {
        return (
            <Box sx={{ p: 2, color: "text.secondary" }}>
                Mark not found.
            </Box>
        )
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
            <MarkInlineEditor />
            <StandardRenderEditor
                title="Description"
                value={working.description ?? new StandardRender([])}
                onChange={handleDescriptionChange}
                validLinkTags={["Feature", "Knowledge"]}
                toolbar={true}
                placeholder="Enter a Description"
                tag="Description"
                debounce={false}
            />
        </Box>
    )
}

/**
 * Full Mark editor (shortName + description). Used when navigating to a Mark
 * via the inline reference list gap. Add/remove Marks stays in the list.
 * Reads the current component id from the workbench breadcrumb (top of stack).
 */
export const MarkEditor: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const markId = useSelector(getCurrentComponentId) as ComponentUUID | null

    const mark = useMemo(() => {
        if (!markId) return null
        const component = standardForm.byUniversalId[markId]
        if (component && component instanceof StandardMark) {
            return component
        }
        return null
    }, [standardForm, markId])

    if (!mark || !markId) {
        return (
            <Box sx={{ p: 2, color: "text.secondary" }}>
                Mark not found.
            </Box>
        )
    }

    return (
        <WorkbenchComponentProvider componentId={markId} guard={markGuard}>
            <MarkEditorBody />
        </WorkbenchComponentProvider>
    )
}

export default MarkEditor
