import React, { FunctionComponent, useCallback } from "react"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import WorkbenchStandardLiteralEditor from "./StandardLiteralEditor"
import { useWorkbenchAsset } from "./useWorkbenchAsset"

export interface MarkInlineEditorProps {
    mark: StandardMark
}

/**
 * Inline editor for a Mark's shortName only. Used in WorkbenchInlineReferenceList
 * edit slots. Description and remove affordances are handled elsewhere (detail view, list).
 */
export const MarkInlineEditor: FunctionComponent<MarkInlineEditorProps> = ({ mark }) => {
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

    return (
        <WorkbenchStandardLiteralEditor
            value={mark.shortName ?? new StandardLiteral("")}
            onChange={handleShortNameChange}
            placeholder="Mark short name..."
            size="small"
            variant="filled"
            readonly={readonly}
        />
    )
}

export default MarkInlineEditor
