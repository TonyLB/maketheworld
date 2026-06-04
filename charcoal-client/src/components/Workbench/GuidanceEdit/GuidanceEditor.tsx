import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useSelector } from "react-redux"
import { Box, TextField, Typography } from "@mui/material"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardGuidance from "@tonylb/mtw-wml/ts/standardize/components/guidance"
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetsEditor } from "../MarkFacetsEditor"
import { getCurrentComponentId, getCurrentComponentLayerId } from "../../../slices/UI/workbench"
import type { ScopedInstrumentationOptions } from "../../../testing/scopedInstrumentation"
import {
    WorkbenchComponentProvider,
    WorkbenchShortNameField,
    useWorkbenchComponent
} from "../foundations/WorkbenchComponent"
import { literalPlainString } from "../foundations/workbenchMutations"

export interface GuidanceEditorProps {
    /** Optional scoped instrumentation for debugging. */
    options?: ScopedInstrumentationOptions
}

const guidanceGuard = (
    component: StandardComponent | undefined
): component is StandardGuidance => component instanceof StandardGuidance

type GuidanceEditorBodyProps = {
    options?: ScopedInstrumentationOptions
}

export const GuidanceEditorBody: FunctionComponent<GuidanceEditorBodyProps> = ({ options }) => {
    const { working, updateComponent, readonly: sessionReadonly } =
        useWorkbenchComponent<StandardGuidance>()

    const instructionsStringValue = useMemo(
        () => literalPlainString(working?.instructions),
        [working?.instructions]
    )

    const handleInstructionsChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = event.target.value
            updateComponent((draft) => {
                draft._payload._instructions = newValue.trim()
                    ? new StandardLiteral(newValue, { tag: "Instructions" })
                    : undefined
            })
        },
        [updateComponent]
    )

    if (!working) {
        return null
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <WorkbenchShortNameField placeholder="Guidance short name..." />
            <Box
                sx={{
                    display: "flex",
                    border: (theme) =>
                        `2px solid ${(theme.palette as { extras?: { sectionBorder?: string } }).extras?.sectionBorder ?? theme.palette.primary.main}`,
                    borderRadius: "0.5em",
                    overflow: "hidden",
                    width: "100%",
                    flexDirection: "column"
                }}
            >
                <Box
                    sx={{
                        backgroundColor: (theme) =>
                            (theme.palette as { extras?: { sectionHeaderBackground?: string } })
                                .extras?.sectionHeaderBackground ?? theme.palette.primary.light,
                        borderBottom: (theme) =>
                            `1px solid ${(theme.palette as { extras?: { sectionBorder?: string } }).extras?.sectionBorder ?? theme.palette.primary.main}`,
                        paddingLeft: "0.75em",
                        paddingRight: "0.75em",
                        paddingTop: "0.5em",
                        paddingBottom: "0.5em"
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                        Instructions
                    </Typography>
                </Box>
                <Box sx={{ p: 1, backgroundColor: "background.paper" }}>
                    <TextField
                        value={instructionsStringValue}
                        onChange={handleInstructionsChange}
                        placeholder="General guidance for rendering algorithm"
                        disabled={sessionReadonly}
                        fullWidth
                        multiline
                        minRows={4}
                        size="small"
                        variant="outlined"
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                backgroundColor: "transparent"
                            }
                        }}
                    />
                </Box>
            </Box>
            <MarkFacetsEditor options={options} />
        </Box>
    )
}

/**
 * Guidance payload editor. Reads the current Guidance id from the workbench: when in
 * layered context (e.g. Room -> Guidance) uses the layer id; otherwise the top breadcrumb.
 */
export const GuidanceEditor: FunctionComponent<GuidanceEditorProps> = ({ options }) => {
    const { standardForm } = useWorkbenchAsset()
    const componentId = (useSelector(getCurrentComponentLayerId) ??
        useSelector(getCurrentComponentId)) as ComponentUUID | null

    const component = useMemo(() => {
        if (!componentId) return null
        const c = standardForm.byUniversalId[componentId]
        if (c && c instanceof StandardGuidance) return c
        return null
    }, [standardForm, componentId])

    if (!component || !componentId) {
        return null
    }

    return (
        <WorkbenchComponentProvider
            componentId={componentId}
            guard={guidanceGuard}
        >
            <GuidanceEditorBody options={options} />
        </WorkbenchComponentProvider>
    )
}

export default GuidanceEditor
