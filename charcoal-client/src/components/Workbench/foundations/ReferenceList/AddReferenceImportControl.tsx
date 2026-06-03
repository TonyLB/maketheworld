import React, { FunctionComponent, useCallback, useMemo, useState } from "react"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import AddIcon from "@mui/icons-material/Add"
import LinkIcon from "@mui/icons-material/Link"
import ImportExportIcon from "@mui/icons-material/ImportExport"

import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { addImportToDraft } from "../../../../slices/personalAssets"
import { ComponentSelectorDialog } from "../ComponentSelector"
import ImportComponentDialog from "../../ImportComponentDialog"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { AssetUUID, ComponentUUID, isImportableTag } from "@tonylb/mtw-base/ts/schema"
import type { SchemaImportMapping } from "@tonylb/mtw-base/ts/schema/metaData"

export type ComponentTag =
    | "Character"
    | "Map"
    | "Room"
    | "Area"
    | "Feature"
    | "Knowledge"
    | "Guidance"
    | "Situation"
    | "Lens"
    | "Mark"
    | "Message"

export type ImportTag = SchemaImportMapping["type"]

export interface AddReferenceImportLabels {
    add?: string
    referenceExisting?: string
    import?: string
}

export interface AddReferenceImportProps {
    tag: ComponentTag
    isExcluded: (universalKey: ComponentUUID) => boolean
    /** Called with the ref and draft to place the ref on the draft. Control always provides the draft. */
    association: (ref: StandardReference, draft: StandardForm) => void
    /** When user clicks Create new, the control calls requestCreate(onCreated). Creating pattern calls onCreated(ref) when done. */
    requestCreate: (onCreated: (ref: StandardReference) => void) => void
    labels?: AddReferenceImportLabels
    enableReferenceExisting?: boolean
    enableImport?: boolean
    disabled?: boolean
    /** When set, used for Import dialog tag filter; otherwise `tag` is used. */
    importTag?: ImportTag
    /**
     * When set, reference existing associates via this callback instead of updateStandard.
     * Used by parent-session editors (updateComponent on working).
     */
    onAssociateReference?: (ref: StandardReference) => void
    /**
     * When set, replaces internal updateStandard for import and create-complete association.
     * Used by parent-session editors (commitAssetScopedUpdate).
     */
    persistDraftUpdate?: (update: (draft: StandardForm) => void) => void
}

export function useAddReferenceImport(props: AddReferenceImportProps): {
    actionRows: React.ReactNode
    selectorDialog: React.ReactNode
    importDialog: React.ReactNode
} {
    const {
        tag,
        isExcluded,
        association,
        requestCreate,
        labels,
        enableReferenceExisting = true,
        enableImport = isImportableTag(tag),
        disabled: disabledProp = false,
        importTag,
        onAssociateReference,
        persistDraftUpdate
    } = props

    const { updateStandard, readonly, AssetId } = useWorkbenchAsset()
    const disabled = disabledProp ?? readonly

    const [selectorOpen, setSelectorOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    const effectiveImportTag = importTag ?? (tag as ImportTag)
    const addLabel = labels?.add ?? `Add ${tag}`
    const refExistingLabel = labels?.referenceExisting ?? `Reference existing ${tag}`
    const importLabel = labels?.import ?? "Import"

    const persistAssociation = useCallback(
        (ref: StandardReference) => {
            if (onAssociateReference) {
                onAssociateReference(ref)
                return
            }
            if (persistDraftUpdate) {
                persistDraftUpdate((draft) => {
                    association(ref, draft)
                })
                return
            }
            updateStandard({
                type: "update",
                update: (draft) => {
                    association(ref, draft)
                    return draft
                }
            })
        },
        [onAssociateReference, persistDraftUpdate, association, updateStandard]
    )

    const handleCreateNew = useCallback(() => {
        if (disabled) return
        requestCreate((ref) => persistAssociation(ref))
    }, [disabled, requestCreate, persistAssociation])

    const handleReferenceSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (disabled) return
            const ref = new StandardReference({ universalKey, tag })
            persistAssociation(ref)
            setSelectorOpen(false)
        },
        [disabled, tag, persistAssociation]
    )

    const handleImportSelect = useCallback(
        (fromAsset: AssetUUID, uuid: ComponentUUID, tagParam: ImportTag) => {
            if (disabled) return
            const ref = new StandardReference({ universalKey: uuid, tag: tagParam })
            if (onAssociateReference) {
                onAssociateReference(ref)
            }
            if (persistDraftUpdate) {
                persistDraftUpdate((draft) => {
                    const importedRef = addImportToDraft(draft, { fromAsset, uuid, tag: tagParam })
                    if (importedRef && !onAssociateReference) {
                        association(importedRef, draft)
                    }
                })
            } else {
                updateStandard({
                    type: "update",
                    update: (draft) => {
                        const importedRef = addImportToDraft(draft, { fromAsset, uuid, tag: tagParam })
                        if (importedRef) association(importedRef, draft)
                        return draft
                    }
                })
            }
            setImportDialogOpen(false)
        },
        [disabled, persistDraftUpdate, onAssociateReference, association, updateStandard]
    )

    const actionRows = useMemo(
        () => (
            <>
                <ListItem>
                    <ListItemButton
                        onClick={handleCreateNew}
                        disabled={disabled}
                        sx={{ justifyContent: "center" }}
                    >
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText primary={addLabel} />
                    </ListItemButton>
                </ListItem>
                {enableReferenceExisting && (
                    <ListItem>
                        <ListItemButton
                            onClick={() => setSelectorOpen(true)}
                            disabled={disabled}
                            sx={{ justifyContent: "center" }}
                        >
                            <ListItemIcon>
                                <LinkIcon />
                            </ListItemIcon>
                            <ListItemText primary={refExistingLabel} />
                        </ListItemButton>
                    </ListItem>
                )}
                {enableImport && (
                    <ListItem>
                        <ListItemButton
                            onClick={() => setImportDialogOpen(true)}
                            disabled={disabled}
                            sx={{ justifyContent: "center" }}
                        >
                            <ListItemIcon>
                                <ImportExportIcon />
                            </ListItemIcon>
                            <ListItemText primary={importLabel} />
                        </ListItemButton>
                    </ListItem>
                )}
            </>
        ),
        [
            handleCreateNew,
            disabled,
            addLabel,
            enableReferenceExisting,
            refExistingLabel,
            enableImport,
            importLabel
        ]
    )

    const selectorDialog =
        enableReferenceExisting ? (
            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag={tag}
                onSelect={handleReferenceSelect}
                isExcluded={isExcluded}
            />
        ) : null

    const importDialog =
        enableImport ? (
            <ImportComponentDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                assetId={AssetId}
                onImportSelect={handleImportSelect}
                tag={effectiveImportTag}
                isExcluded={isExcluded}
            />
        ) : null

    return { actionRows, selectorDialog, importDialog }
}

export const AddReferenceImportControl: FunctionComponent<AddReferenceImportProps> = (props) => {
    const { actionRows, selectorDialog, importDialog } = useAddReferenceImport(props)
    return (
        <>
            {actionRows}
            {selectorDialog}
            {importDialog}
        </>
    )
}

export default AddReferenceImportControl
