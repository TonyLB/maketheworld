import React, { FunctionComponent, useCallback } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import DeleteIcon from "@mui/icons-material/Delete"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import type { InlineReferenceListAffordances } from "./WorkbenchInlineReferenceList"
import WorkbenchStandardLiteralEditor from "./StandardLiteralEditor"
import WorkbenchStandardRenderEditor from "./StandardRenderEditor"
import WorkbenchTitledBox from "./WorkbenchTitledBox"
import { useWorkbenchAsset } from "./useWorkbenchAsset"

export interface MarkInlineEditorProps {
    mark: StandardMark
    /** When provided, the editor renders the remove affordance (e.g. on the same row as Short Name) for a compact layout. */
    affordances?: InlineReferenceListAffordances
}

export const MarkInlineEditor: FunctionComponent<MarkInlineEditorProps> = ({
    mark,
    affordances
}) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const markUniversalKey = mark.universalKey

    const handleShortNameChange = useCallback(
        (newShortName: StandardLiteral) => {
            if (!markUniversalKey || readonly) return
            const currentMark = standardForm.byUniversalId[markUniversalKey]
            if (!currentMark || !(currentMark instanceof StandardMark)) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ''
            const currentValue = currentMark.shortName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const m = draft.byUniversalId[markUniversalKey]
                    if (m && m instanceof StandardMark) {
                        m._payload._shortName = newValue ? newShortName : undefined
                    }
                    return draft
                }
            })
        },
        [markUniversalKey, standardForm, updateStandard, readonly]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            if (!markUniversalKey || readonly) return
            const currentMark = standardForm.byUniversalId[markUniversalKey]
            if (!currentMark || !(currentMark instanceof StandardMark)) return
            const newValue = newDescription.toJSON() ?? []
            const currentValue = currentMark.description?.toJSON() ?? []
            if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const m = draft.byUniversalId[markUniversalKey]
                    if (m && m instanceof StandardMark) {
                        const isEmpty = !newValue || (Array.isArray(newValue) && newValue.length === 0)
                        m._payload._description = isEmpty ? undefined : newDescription
                    }
                    return draft
                }
            })
        },
        [markUniversalKey, standardForm, updateStandard, readonly]
    )

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WorkbenchStandardLiteralEditor
                        value={mark.shortName ?? new StandardLiteral("")}
                        onChange={handleShortNameChange}
                        placeholder="Mark short name..."
                        size="small"
                        variant="filled"
                        readonly={readonly}
                    />
                </Box>
                {affordances && (
                    <IconButton
                        aria-label="remove mark"
                        onClick={affordances.onRemove}
                        disabled={affordances.disabled}
                        color="error"
                        size="small"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>
            <WorkbenchTitledBox title="Description">
                <Box sx={{ padding: "0.5em" }}>
                    <WorkbenchStandardRenderEditor
                        value={mark.description ?? new StandardRender([])}
                        onChange={handleDescriptionChange}
                        validLinkTags={[]}
                        toolbar={false}
                    />
                </Box>
            </WorkbenchTitledBox>
        </Box>
    )
}

export default MarkInlineEditor
