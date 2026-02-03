import React, { FunctionComponent, useCallback, useMemo, useEffect, useState } from "react"
import { Box, TextField, Typography } from "@mui/material"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardGuidance from "@tonylb/mtw-wml/ts/standardize/components/guidance"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { TopLevelStandardLiteralEditor } from "../foundations/StandardLiteral"
import { useDebouncedOnChange } from "../../../hooks/useDebounce"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetsEditor } from "../MarkFacetsEditor"
import { MarkFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"

type GuidanceEditorProps = {
    componentId: ComponentUUID
}

export const GuidanceEditor: FunctionComponent<GuidanceEditorProps> = ({ componentId }) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const component = useMemo(() => {
        const c = standardForm.byUniversalId[componentId]
        if (c && c instanceof StandardGuidance) return c
        return null
    }, [standardForm, componentId])

    const handleShortNameChange = useCallback(
        (newShortName: StandardLiteral) => {
            if (!componentId || readonly) return
            const current = standardForm.byUniversalId[componentId]
            if (!current || !(current instanceof StandardGuidance)) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ''
            const currentValue = current.shortName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const g = draft.byUniversalId[componentId]
                    if (g && g instanceof StandardGuidance) {
                        g._payload._shortName = newValue ? newShortName : undefined
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    const instructionsStringValue = useMemo(() => {
        return component?.instructions?._payload?.plain?.toJSON() ?? ''
    }, [component])
    const [localInstructions, setLocalInstructions] = useState<string>(instructionsStringValue)
    useEffect(() => {
        setLocalInstructions(instructionsStringValue)
    }, [instructionsStringValue])

    useDebouncedOnChange({
        value: localInstructions,
        delay: 1000,
        onChange: (newValue: string) => {
            if (!componentId || readonly) return
            const current = standardForm.byUniversalId[componentId]
            if (!current || !(current instanceof StandardGuidance)) return
            const currentValue = current.instructions?._payload?.plain?.toJSON() ?? ''
            if (newValue === currentValue || (!newValue && !currentValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const g = draft.byUniversalId[componentId]
                    if (g && g instanceof StandardGuidance) {
                        g._payload._instructions = newValue
                            ? new StandardLiteral(newValue, { tag: 'Instructions' })
                            : undefined
                    }
                    return draft
                }
            })
        }
    })

    const handleInstructionsChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalInstructions(event.target.value)
    }, [])

    const handleMarksChange = useCallback(
        (newMarks: MarkFacetList) => {
            if (!componentId || readonly) return
            const current = standardForm.byUniversalId[componentId]
            if (!current || !(current instanceof StandardGuidance)) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const g = draft.byUniversalId[componentId]
                    if (g && g instanceof StandardGuidance) {
                        g._payload._marks = newMarks
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TopLevelStandardLiteralEditor
                value={component.shortName ?? new StandardLiteral('')}
                onChange={handleShortNameChange}
                label="Short Name"
                placeholder="Guidance short name..."
                size="small"
                readonly={readonly}
            />
            <Box
                sx={{
                    display: 'flex',
                    border: (theme) => `2px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`,
                    borderRadius: '0.5em',
                    overflow: 'hidden',
                    width: '100%',
                    flexDirection: 'column'
                }}
            >
                <Box
                    sx={{
                        backgroundColor: (theme) => (theme.palette as any).extras?.sectionHeaderBackground ?? theme.palette.primary.light,
                        borderBottom: (theme) => `1px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`,
                        paddingLeft: '0.75em',
                        paddingRight: '0.75em',
                        paddingTop: '0.5em',
                        paddingBottom: '0.5em'
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        Instructions
                    </Typography>
                </Box>
                <Box sx={{ p: 1, backgroundColor: 'background.paper' }}>
                    <TextField
                        value={localInstructions}
                        onChange={handleInstructionsChange}
                        placeholder="General guidance for rendering algorithm"
                        disabled={readonly}
                        fullWidth
                        multiline
                        minRows={4}
                        size="small"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'transparent'
                            }
                        }}
                    />
                </Box>
            </Box>
            <MarkFacetsEditor
                componentId={componentId}
                marks={component.marks}
                onChange={handleMarksChange}
                readonly={readonly}
            />
        </Box>
    )
}

export default GuidanceEditor
