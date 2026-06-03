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
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { defaultedEquals } from "@tonylb/mtw-wml/ts/standardize/components/utils"
import { LensMarkFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardRenderEditor } from "../foundations/StandardRender"
import { LensMarkFacetsEditor } from "./LensMarkFacetsEditor"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import {
    WorkbenchComponentProvider,
    WorkbenchShortNameField,
    useWorkbenchComponent
} from "../foundations/WorkbenchComponent"
import { literalPlainString } from "../foundations/workbenchMutations"

const lensGuard = (
    component: StandardComponent | undefined
): component is StandardLens => component instanceof StandardLens

type LensDetailEditBodyProps = {
    lensId: ComponentUUID
}

const LensDetailEditBody: FunctionComponent<LensDetailEditBodyProps> = ({ lensId }) => {
    const { working, updateComponent, readonly: sessionReadonly } =
        useWorkbenchComponent<StandardLens>()

    const title = useMemo(() => {
        const shortName = literalPlainString(working?.shortName)
        return shortName.trim() || "Lens (no short name)"
    }, [working?.shortName])

    const handleLensMarksChange = useCallback(
        (newMarks: LensMarkFacetList) => {
            updateComponent((draft) => {
                draft._payload._marks = newMarks
            })
        },
        [updateComponent]
    )

    const updateLensDescription = useCallback(
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
        return null
    }

    return (
        <>
            <Typography variant="h6">{title}</Typography>

            <WorkbenchShortNameField placeholder="Enter lens short name..." />

            <LensMarkFacetsEditor
                lensId={lensId}
                marks={working.marks}
                onChange={handleLensMarksChange}
                readonly={sessionReadonly}
            />

            <StandardRenderEditor
                title="Description"
                value={working.description ?? new StandardRender([])}
                onChange={updateLensDescription}
                validLinkTags={["Feature", "Knowledge"]}
                toolbar={true}
                placeholder="Enter a Description"
                tag="Description"
                debounce={false}
            />
        </>
    )
}

/**
 * Full Lens detail view. Renders when the workbench navigates to a Lens (e.g. from LensHeader "Edit").
 * Edits ShortName, Mark facets, and Description using a component editor session.
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

    if (!lens || !lensId) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Lens not found.</Typography>
                <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 1 }}>
                    Back
                </Button>
            </Box>
        )
    }

    const getReferrerDisplayName = (universalKey: string | undefined): string => {
        if (!universalKey) return "Untitled"
        const comp = standardForm.byUniversalId[universalKey as ComponentUUID]
        if (!comp) return "Untitled"
        const sn = (comp as { shortName?: { _payload?: { plain?: { toJSON?: () => unknown } } } })
            .shortName?._payload?.plain?.toJSON?.()
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
                        gap: 0.75
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
            <WorkbenchComponentProvider componentId={lensId} guard={lensGuard}>
                <LensDetailEditBody lensId={lensId} />
            </WorkbenchComponentProvider>
        </Box>
    )
}

export default LensDetail
