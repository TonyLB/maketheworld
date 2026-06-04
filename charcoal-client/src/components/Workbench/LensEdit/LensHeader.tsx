import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useDispatch } from "react-redux"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { useWorkbenchComponent } from "../foundations/WorkbenchComponent"
import { confirmSiteDisassociateBeforeComponentDisassociate } from "../foundations/consistency/confirmSiteDisassociateBeforeLocalEdit"
import DeleteIcon from "@mui/icons-material/Delete"
import EditIcon from "@mui/icons-material/Edit"
import { MakeTheWorldAccordion } from "../../UI"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { SingleReference } from "@tonylb/mtw-wml/ts/standardize/keys/singleReference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { v4 as uuidv4 } from "uuid"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { renderTreeToPlainText } from "../foundations/renderTreeToPlainText"
import { useAddReferenceImport } from "../foundations/ReferenceList/AddReferenceImportControl"

export type LensHeaderProps = {
    RoomId: ComponentUUID
    onEditLens?: (lensId: ComponentUUID) => void
}

function getLensSummaryLabel(lens: StandardLens): string {
    const plain = lens.shortName?._payload?.plain?.toJSON()
    const str = typeof plain === "string" ? plain : undefined
    if (str?.trim()) return str
    return "Lens (no short name)"
}

export const LensHeader: FunctionComponent<LensHeaderProps> = ({ RoomId, onEditLens }) => {
    const dispatch = useDispatch()
    const {
        standardForm,
        localStandardForm,
        materializeComponentInAsset,
        readonly: assetReadonly
    } = useWorkbenchAsset()
    const {
        working,
        updateComponent,
        readonly: sessionReadonly,
        missing
    } = useWorkbenchComponent<StandardRoom>()
    const readonly = assetReadonly || sessionReadonly

    const lensPayload = useMemo(() => working?.lens.payload ?? [], [working])
    const singleLensRef = useMemo(() => {
        if (lensPayload.length !== 1) return undefined
        const ref = lensPayload[0]
        return ref?.universalKey ? ref : undefined
    }, [lensPayload])

    const lensUniversalKey = useMemo(
        () => (singleLensRef?.universalKey as ComponentUUID) ?? null,
        [singleLensRef]
    )

    const singleLens = useMemo(() => {
        if (!lensUniversalKey) return null
        const component = standardForm.byUniversalId[lensUniversalKey]
        if (component && component instanceof StandardLens) {
            return component
        }
        return null
    }, [lensUniversalKey, standardForm])

    const isLensExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            lensPayload.some((ref) => ref.universalKey === universalKey),
        [lensPayload]
    )

    const clearLensReference = useCallback(() => {
        if (!working || readonly || !lensUniversalKey) return
        void (async () => {
            const proceed = await confirmSiteDisassociateBeforeComponentDisassociate({
                dispatch,
                localStandardForm,
                standardForm,
                componentId: RoomId,
                working,
                target: singleLensRef!,
                siteLabel: "this Room's Lens",
                applyDisassociateOnWorking: (sim) => {
                    sim._payload._lens = new SingleReference([])
                }
            })
            if (!proceed) {
                return
            }
            updateComponent((draft) => {
                draft._payload._lens = new SingleReference([])
            })
        })()
    }, [
        working,
        readonly,
        lensUniversalKey,
        dispatch,
        localStandardForm,
        standardForm,
        singleLensRef,
        RoomId,
        updateComponent
    ])

    const onAssociateReference = useCallback(
        (ref: StandardReference) => {
            if (readonly || missing || !working) return
            updateComponent((draft) => {
                draft._payload._lens = SingleReference.fromValue(ref)
            })
        },
        [readonly, missing, working, updateComponent]
    )

    const association = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const base = draft.byUniversalId[RoomId]
            if (base instanceof StandardRoom) {
                base._payload._lens = SingleReference.fromValue(ref)
            }
        },
        [RoomId]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (missing || !working || readonly) return
            const universalKey = enforceTypedKey("LENS")(uuidv4()) as ComponentUUID
            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey })
                onCreated(ref)
            })()
        },
        [missing, working, readonly, materializeComponentInAsset]
    )

    const { actionRows, selectorDialog, importDialog } = useAddReferenceImport({
        tag: "Lens",
        isExcluded: isLensExcluded,
        association,
        requestCreate,
        onAssociateReference,
        labels: {
            add: "Create New Lens",
            referenceExisting: "Reference Existing Lens",
            import: "Import Lens"
        },
        enableReferenceExisting: true,
        enableImport: true,
        disabled: readonly
    })

    const descriptionExcerpt = useMemo(() => {
        if (!singleLens?.description) return undefined
        const tree = singleLens.description.toJSON?.()
        if (!tree) return undefined
        const text = renderTreeToPlainText(tree)
        return text.slice(0, 80) + (text.length > 80 ? "..." : "")
    }, [singleLens?.description])

    const marksSummary = useMemo(() => {
        if (!singleLens?.marks) return undefined
        const items = singleLens.marks.items ?? []
        const count = items.length
        if (count === 0) return undefined
        return count === 1 ? "1 mark" : `${count} marks`
    }, [singleLens?.marks])

    if (missing || !working) {
        return (
            <MakeTheWorldAccordion title="Lens" defaultExpanded>
                <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
                    Room not found
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    if (lensUniversalKey && !singleLens) {
        return (
            <MakeTheWorldAccordion title="Lens" defaultExpanded>
                <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Alert severity="warning">
                        Lens data is in an unexpected state for this room.
                    </Alert>
                    <Button
                        size="small"
                        color="primary"
                        onClick={clearLensReference}
                        disabled={readonly}
                    >
                        Clear Lens reference
                    </Button>
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    if (!singleLens) {
        return (
            <>
                <MakeTheWorldAccordion title="Dynamic Rendering" defaultExpanded={false}>
                    <Box sx={{ p: 2, pt: 0 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            To unlock dynamic rendering on this room, associate a Lens.
                        </Typography>
                        <List>{actionRows}</List>
                    </Box>
                </MakeTheWorldAccordion>
                {selectorDialog}
                {importDialog}
            </>
        )
    }

    return (
        <MakeTheWorldAccordion title="Lens" defaultExpanded>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {getLensSummaryLabel(singleLens)}
                        </Typography>
                        {descriptionExcerpt && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {descriptionExcerpt}
                            </Typography>
                        )}
                        {marksSummary && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                {marksSummary}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                        {onEditLens && (
                            <IconButton
                                aria-label="Edit Lens"
                                onClick={() => onEditLens(lensUniversalKey!)}
                                size="small"
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        )}
                        <IconButton
                            aria-label="Delete Lens reference"
                            onClick={clearLensReference}
                            disabled={readonly}
                            size="small"
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
            </Box>
        </MakeTheWorldAccordion>
    )
}

export default LensHeader
