import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import { useDispatch } from "react-redux"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import AddIcon from "@mui/icons-material/Add"
import DeleteIcon from "@mui/icons-material/Delete"
import LinkIcon from "@mui/icons-material/Link"
import EditIcon from "@mui/icons-material/Edit"
import ImportExportIcon from "@mui/icons-material/ImportExport"
import { MakeTheWorldAccordion } from "../../UI"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { SingleReference } from "@tonylb/mtw-wml/ts/standardize/keys/singleReference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ComponentSelectorDialog } from "../foundations/ComponentSelector"
import ImportComponentDialog from "../ImportComponentDialog"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { v4 as uuidv4 } from "uuid"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { addImport } from "../../../slices/personalAssets"
import type { ReferenceListDescriptor } from "../../../slices/personalAssets"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"

export type LensHeaderProps = {
    RoomId: ComponentUUID
    onEditLens?: (lensId: ComponentUUID) => void
}

const renderTreeToPlainText = (tree: RenderTree): string => {
    if (!tree || tree.length === 0) return ""
    return tree
        .map((item) => {
            if (typeof item === "string") {
                return item
            }
            if (isSchemaString(item.data)) {
                return item.data.value
            }
            if (item.children && item.children.length > 0) {
                return item.children
                    .filter((child): child is string => typeof child === "string")
                    .join("")
            }
            return ""
        })
        .filter(Boolean)
        .join(" ")
        .trim()
}

function getLensSummaryLabel(lens: StandardLens): string {
    const plain = lens.shortName?._payload?.plain?.toJSON()
    const str = typeof plain === "string" ? plain : undefined
    if (str?.trim()) return str
    return "Lens (no short name)"
}

export const LensHeader: FunctionComponent<LensHeaderProps> = ({ RoomId, onEditLens }) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId } = useWorkbenchAsset()
    const [lensSelectorOpen, setLensSelectorOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    const room = useMemo(() => {
        if (RoomId) {
            const component = standardForm.byUniversalId[RoomId]
            if (component && component instanceof StandardRoom) {
                return component
            }
        }
        return null
    }, [RoomId, standardForm])

    const lensPayload = useMemo(() => room?.lenses.payload ?? [], [room])
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

    const createAndAddLens = useCallback(() => {
        if (!room || readonly) return
        const LensKey = enforceTypedKey("LENS")
        const uuid = uuidv4()
        const lensUniversalKey = LensKey(uuid) as ComponentUUID
        updateStandard({
            type: "update",
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    const newLens = new StandardLens({
                        tag: "Lens",
                        universalKey: lensUniversalKey
                    })
                    draft.byUniversalId[lensUniversalKey] = newLens
                    const lensReference = new StandardReference({
                        universalKey: lensUniversalKey,
                        tag: "Lens"
                    })
                    base._payload._lenses = SingleReference.fromValue(lensReference)
                }
                return draft
            }
        })
    }, [room, RoomId, updateStandard, readonly])

    const setLensReference = useCallback(
        (universalKey: ComponentUUID) => {
            if (!room || readonly) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const base = draft.byUniversalId[RoomId]
                    if (base instanceof StandardRoom) {
                        const lensReference = new StandardReference({
                            universalKey,
                            tag: "Lens"
                        })
                        base._payload._lenses = SingleReference.fromValue(lensReference)
                    }
                    return draft
                }
            })
        },
        [room, RoomId, updateStandard, readonly]
    )

    const isLensExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            lensPayload.some((ref) => ref.universalKey === universalKey),
        [lensPayload]
    )

    const clearLensReference = useCallback(() => {
        if (!room || readonly) return
        updateStandard({
            type: "update",
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[RoomId]
                if (base instanceof StandardRoom) {
                    base._payload._lenses = new SingleReference([])
                }
                return draft
            }
        })
    }, [room, RoomId, updateStandard, readonly])

    const addToReferenceListForRoom = useCallback(
        (draft: StandardForm): ReferenceListDescriptor | null => {
            const roomDraft = draft.byUniversalId[RoomId]
            if (!roomDraft || !(roomDraft instanceof StandardRoom)) return null
            return {
                referenceList: roomDraft.lenses,
                setReferenceList: (list) => {
                    ;(roomDraft as StandardRoom)._payload._lenses =
                        list instanceof SingleReference ? list : SingleReference.fromReferenceList(list)
                }
            }
        },
        [RoomId]
    )

    const handleImportSelect = useCallback(
        (fromAsset: AssetUUID, uuid: ComponentUUID, tag: "Room" | "Feature" | "Knowledge" | "Map" | "Moment" | "Message" | "Lens") => {
            if (readonly) return
            dispatch(
                addImport({
                    assetId: AssetId,
                    fromAsset,
                    uuid,
                    tag,
                    addToReferenceList: addToReferenceListForRoom
                })
            )
            setImportDialogOpen(false)
        },
        [readonly, dispatch, AssetId, addToReferenceListForRoom]
    )

    const descriptionExcerpt = useMemo(() => {
        if (!singleLens?.description) return undefined
        const tree = singleLens.description.toJSON?.() as RenderTree | undefined
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

    if (!room) {
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
                <MakeTheWorldAccordion title="Lens" defaultExpanded>
                    <List>
                        <ListItem>
                            <ListItemButton
                                onClick={createAndAddLens}
                                disabled={readonly}
                                sx={{ justifyContent: "center" }}
                            >
                                <ListItemIcon>
                                    <AddIcon />
                                </ListItemIcon>
                                <ListItemText primary="Create New Lens" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton
                                onClick={() => setLensSelectorOpen(true)}
                                disabled={readonly}
                                sx={{ justifyContent: "center" }}
                            >
                                <ListItemIcon>
                                    <LinkIcon />
                                </ListItemIcon>
                                <ListItemText primary="Reference Existing Lens" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton
                                onClick={() => setImportDialogOpen(true)}
                                disabled={readonly}
                                sx={{ justifyContent: "center" }}
                            >
                                <ListItemIcon>
                                    <ImportExportIcon />
                                </ListItemIcon>
                                <ListItemText primary="Import Lens" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </MakeTheWorldAccordion>
                <ComponentSelectorDialog
                    open={lensSelectorOpen}
                    onClose={() => setLensSelectorOpen(false)}
                    tag="Lens"
                    onSelect={setLensReference}
                    isExcluded={isLensExcluded}
                />
                <ImportComponentDialog
                    open={importDialogOpen}
                    onClose={() => setImportDialogOpen(false)}
                    assetId={AssetId}
                    onImportSelect={handleImportSelect}
                    tag="Lens"
                    isExcluded={isLensExcluded}
                />
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
