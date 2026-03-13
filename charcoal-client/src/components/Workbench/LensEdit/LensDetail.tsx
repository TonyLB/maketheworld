import React, { FunctionComponent, useMemo } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import { useDispatch, useSelector } from "react-redux"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { getCurrentComponentId, getBreadcrumbStack, navigateViaBreadcrumbIndex } from "../../../slices/UI/workbench"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

/**
 * Minimal Lens detail view. Renders when the workbench navigates to a Lens (e.g. from LensHeader "Edit").
 * Full editing (ShortName, Mark facets, Description) will be implemented in a follow-up; this placeholder
 * shows the lens summary and a back action.
 */
export const LensDetail: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)
    const stack = useSelector(getBreadcrumbStack)

    const lens = useMemo(() => {
        if (!currentComponentId) return null
        const component = standardForm.byUniversalId[currentComponentId as ComponentUUID]
        if (component && component instanceof StandardLens) {
            return component
        }
        return null
    }, [currentComponentId, standardForm])

    const handleBack = () => {
        // Go back one step. Index 0 = asset root; 1 = first component, etc.
        const targetIndex = Math.max(0, stack.length - 1)
        dispatch(navigateViaBreadcrumbIndex(targetIndex))
    }

    if (!lens) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Lens not found.</Typography>
                <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 1 }}>
                    Back
                </Button>
            </Box>
        )
    }

    const shortName =
        typeof lens.shortName?._payload?.plain?.toJSON() === "string"
            ? (lens.shortName!._payload!.plain!.toJSON() as string)
            : ""
    const title = shortName.trim() || "Lens (no short name)"

    return (
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                size="small"
                sx={{ alignSelf: "flex-start" }}
            >
                Back
            </Button>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
                Full lens editor (ShortName, Marks, Description) coming in a follow-up.
            </Typography>
        </Box>
    )
}

export default LensDetail
