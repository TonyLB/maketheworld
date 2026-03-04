import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useSelector } from "react-redux"
import { Box } from "@mui/material"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardSituation from "@tonylb/mtw-wml/ts/standardize/components/situation"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetsEditor } from "../MarkFacetsEditor"
import { MarkFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import { getCurrentComponentId, getCurrentComponentLayerId } from "../../../slices/UI/workbench"
import { TopLevelStandardLiteralEditor } from "../foundations/StandardLiteral"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"

/**
 * Situation payload editor. Allows editing of Situation shortName (for labels)
 * and Mark facets (world-state slice).
 */
export const SituationEditor: FunctionComponent = () => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const componentId = (useSelector(getCurrentComponentLayerId) ?? useSelector(getCurrentComponentId)) as ComponentUUID | null

    const component = useMemo(() => {
        if (!componentId) return null
        const c = standardForm.byUniversalId[componentId]
        if (c && c instanceof StandardSituation) return c
        return null
    }, [standardForm, componentId])

    const handleShortNameChange = useCallback(
        (newShortName: StandardLiteral) => {
            if (!componentId || readonly) return
            const current = standardForm.byUniversalId[componentId]
            if (!current || !(current instanceof StandardSituation)) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ''
            const currentValue = current.shortName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const s = draft.byUniversalId[componentId]
                    if (s && s instanceof StandardSituation) {
                        s._payload._shortName = newValue
                            ? new StandardLiteral(newValue, { tag: 'ShortName' })
                            : undefined
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    const handleMarksChange = useCallback(
        (newMarks: MarkFacetList) => {
            if (!componentId || readonly) return
            const current = standardForm.byUniversalId[componentId]
            if (!current || !(current instanceof StandardSituation)) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const s = draft.byUniversalId[componentId]
                    if (s && s instanceof StandardSituation) {
                        s._payload._marks = newMarks
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    if (!component) {
        return null
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TopLevelStandardLiteralEditor
                value={component.shortName ?? new StandardLiteral('')}
                onChange={handleShortNameChange}
                label="Short Name"
                placeholder="Situation short name..."
                size="small"
                readonly={readonly}
            />
            <MarkFacetsEditor
                componentId={componentId!}
                marks={component.marks}
                onChange={handleMarksChange}
                readonly={readonly}
            />
        </Box>
    )
}

export default SituationEditor
