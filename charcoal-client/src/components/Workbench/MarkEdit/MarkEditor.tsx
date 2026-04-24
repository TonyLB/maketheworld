import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useSelector } from "react-redux"
import Box from "@mui/material/Box"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { defaultedEquals } from "@tonylb/mtw-wml/ts/standardize/components/utils"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardLiteralEditor } from "../foundations/StandardLiteral"
import { StandardRenderEditor } from "../foundations/StandardRender"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { getCurrentComponentId } from "../../../slices/UI/workbench"

/**
 * Full Mark editor (shortName + description). Used when navigating to a Mark
 * via the inline reference list gap. Add/remove Marks stays in the list.
 * Reads the current component id from the workbench breadcrumb (top of stack).
 */
export const MarkEditor: FunctionComponent = () => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const markId = useSelector(getCurrentComponentId) as ComponentUUID | null

    const mark = useMemo(() => {
        if (!markId) return null
        const component = standardForm.byUniversalId[markId]
        if (component && component instanceof StandardMark) {
            return component
        }
        return null
    }, [standardForm, markId])

    const handleShortNameChange = useCallback(
        (newShortName: StandardLiteral) => {
            if (!markId || readonly) return
            const currentMark = standardForm.byUniversalId[markId]
            if (!currentMark || !(currentMark instanceof StandardMark)) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ''
            const currentValue = currentMark.shortName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const m = draft.byUniversalId[markId]
                    if (m && m instanceof StandardMark) {
                        m._payload._shortName = newValue ? newShortName : undefined
                    }
                    return draft
                }
            })
        },
        [markId, standardForm, updateStandard, readonly]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            if (!markId || readonly) return
            const currentMark = standardForm.byUniversalId[markId]
            if (!currentMark || !(currentMark instanceof StandardMark)) return
            if (defaultedEquals(currentMark.description, newDescription)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const m = draft.byUniversalId[markId]
                    if (m && m instanceof StandardMark) {
                        m._payload._description = newDescription.isEmpty() ? undefined : newDescription
                    }
                    return draft
                }
            })
        },
        [markId, standardForm, updateStandard, readonly]
    )

    if (!mark) {
        return (
            <Box sx={{ p: 2, color: 'text.secondary' }}>
                Mark not found.
            </Box>
        )
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <StandardLiteralEditor
                value={mark.shortName ?? new StandardLiteral('')}
                onChange={handleShortNameChange}
                label="Short Name"
                placeholder="Mark short name..."
                size="small"
                variant="outlined"
                readonly={readonly}
            />
            <StandardRenderEditor
                title="Description"
                value={mark.description ?? new StandardRender([])}
                onChange={handleDescriptionChange}
                validLinkTags={['Feature', 'Knowledge']}
                toolbar={true}
                placeholder="Enter a Description"
                tag="Description"
            />
        </Box>
    )
}

export default MarkEditor
