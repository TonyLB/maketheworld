import React, { FunctionComponent, useCallback, useMemo } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import Typography from "@mui/material/Typography"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import { useDispatch, useSelector } from "react-redux"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { getCurrentComponentId, getBreadcrumbStack, navigateViaBreadcrumbIndex } from "../../../slices/UI/workbench"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { defaultedEquals } from "@tonylb/mtw-wml/ts/standardize/components/utils"
import { LensMarkFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardLiteralEditor } from "../foundations/StandardLiteral"
import { StandardRenderEditor } from "../foundations/StandardRender"
import { LensMarkFacetsEditor } from "./LensMarkFacetsEditor"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

/**
 * Full Lens detail view. Renders when the workbench navigates to a Lens (e.g. from LensHeader "Edit").
 * Edits ShortName, Mark facets, and Description using the same update patterns as the legacy LensEditor.
 */
export const LensDetail: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
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

    const lensId = useMemo(
        () => (lens?.universalKey ?? currentComponentId) as ComponentUUID | null,
        [lens?.universalKey, currentComponentId]
    )

    const otherReferrers = useMemo(() => {
        if (!lens) return []
        const referrers = standardForm.referencedBy(lens.reference)
        const parentComponentId =
            stack.length >= 2 ? stack[stack.length - 2]?.componentId ?? null : null
        return parentComponentId
            ? referrers.filter((ref) => ref.universalKey !== parentComponentId)
            : referrers
    }, [standardForm, lens, stack])

    const handleBack = () => {
        const targetIndex = Math.max(0, stack.length - 1)
        dispatch(navigateViaBreadcrumbIndex(targetIndex))
    }

    const updateLensShortName = useCallback(
        (newShortName: StandardLiteral) => {
            if (!lensId || readonly) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ""
            const currentValue = lens?.shortName?._payload?.plain?.toJSON() ?? ""
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const target = draft.byUniversalId[lensId]
                    if (target && target instanceof StandardLens) {
                        target._payload._shortName = newValue ? newShortName : undefined
                    }
                    return draft
                }
            })
        },
        [lensId, lens?.shortName, updateStandard, readonly]
    )

    const updateLensDescription = useCallback(
        (newDescription: StandardRender) => {
            if (!lensId || readonly) return
            if (defaultedEquals(lens?.description, newDescription)) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const target = draft.byUniversalId[lensId]
                    if (target && target instanceof StandardLens) {
                        target._payload._description = newDescription.isEmpty() ? undefined : newDescription
                    }
                    return draft
                }
            })
        },
        [lensId, lens?.description, updateStandard, readonly]
    )

    const handleLensMarksChange = useCallback(
        (newMarks: LensMarkFacetList) => {
            if (!lensId || readonly) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const target = draft.byUniversalId[lensId]
                    if (target && target instanceof StandardLens) {
                        target._payload._marks = newMarks
                    }
                    return draft
                }
            })
        },
        [lensId, updateStandard, readonly]
    )

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

    const getReferrerDisplayName = (universalKey: string | undefined): string => {
        if (!universalKey) return "Untitled"
        const comp = standardForm.byUniversalId[universalKey as ComponentUUID]
        if (!comp) return "Untitled"
        const sn = (comp as { shortName?: { _payload?: { plain?: { toJSON?: () => unknown } } } }).shortName?._payload?.plain?.toJSON?.()
        const str = typeof sn === "string" && sn.trim() ? sn : undefined
        if (str) return str
        const k = comp.key
        return typeof k === "string" ? k : "Untitled"
    }

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
            {otherReferrers.length > 0 && (
                <Box
                    sx={{
                        py: 1,
                        px: 1.5,
                        backgroundColor: (theme) => theme.palette.grey[100],
                        borderRadius: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.75,
                    }}
                    role="region"
                    aria-label="Other referrers"
                >
                    <Typography variant="body2" color="text.secondary">
                        Also referenced by:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {/*
                         * FUTURE: Linking from chips to navigate to that component's context
                         * (cross-hierarchy) is out of scope. Add onClick/onKeyDown when implementing.
                         */}
                        {otherReferrers.map((ref, index) => (
                            <Chip
                                key={ref.universalKey ?? ref.key ?? `ref-${index}`}
                                label={getReferrerDisplayName(ref.universalKey)}
                                size="small"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                </Box>
            )}
            <Typography variant="h6">{title}</Typography>

            <StandardLiteralEditor
                value={lens.shortName ?? new StandardLiteral("")}
                onChange={updateLensShortName}
                label="Short Name"
                placeholder="Enter lens short name..."
                size="small"
                variant="outlined"
                readonly={readonly}
            />

            <LensMarkFacetsEditor
                lensId={lensId as ComponentUUID}
                marks={lens.marks}
                onChange={handleLensMarksChange}
                readonly={readonly}
            />

            <StandardRenderEditor
                title="Description"
                value={lens.description ?? new StandardRender([])}
                onChange={updateLensDescription}
                validLinkTags={["Feature", "Knowledge"]}
                toolbar={true}
                placeholder="Enter a Description"
                tag="Description"
            />
        </Box>
    )
}

export default LensDetail
