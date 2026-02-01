import React, { FunctionComponent, ReactNode, useCallback, useMemo, useState } from "react"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import AddIcon from "@mui/icons-material/Add"
import LinkIcon from "@mui/icons-material/Link"
import ImportExportIcon from "@mui/icons-material/ImportExport"

import { useDispatch } from "react-redux"
import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { addImport, type ReferenceListDescriptor } from "../../../../slices/personalAssets"
import { ComponentSelectorDialog } from "../ComponentSelector"
import ImportComponentDialog from "../../ImportComponentDialog"
import { ReferenceListEditorGeneric } from "./ReferenceListEditorGeneric"
import { referenceListToItems } from "./referenceListAdapter"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { standardComponentFactory } from "@tonylb/mtw-wml/ts/standardize/componentFactory"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import { AssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"

export type { ReferenceListItem } from "./ReferenceListEditorGeneric"

export type ComponentTag =
    | "Character"
    | "Map"
    | "Room"
    | "Feature"
    | "Knowledge"
    | "Example"
    | "Lens"
    | "Mark"
    | "Message"

export interface ReferenceListAffordance {
    /** Override for Add button label; default "Add {tag}". */
    addLabel?: string
    /** When true, show "Reference existing {tag}" row that opens component selector. */
    enableReferenceExisting?: boolean
    /** When true, show "Import" row that opens import dialog. Defaults to true when tag is Room|Feature|Knowledge|Map|Message. */
    enableImport?: boolean
    /** Override for Reference existing button label; default "Reference existing {tag}". */
    referenceExistingLabel?: string
}

export interface ReferenceListEditorProps {
    title: string
    listContext: (form: StandardForm) => ReferenceListDescriptor | null
    tag: ComponentTag
    /** Options for Add / Reference existing / Import rows. */
    affordance?: ReferenceListAffordance
    variant?: "contained" | "table"
    icon?: ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
}

const IMPORTABLE_TAGS: ComponentTag[] = [
    "Room",
    "Feature",
    "Knowledge",
    "Map",
    "Message"
]

export const ReferenceListEditor: FunctionComponent<ReferenceListEditorProps> = ({
    title,
    listContext,
    tag,
    affordance,
    variant = "contained",
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick
}) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly, AssetId } = useWorkbenchAsset()
    const disabled = disabledProp ?? readonly
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const canImport = IMPORTABLE_TAGS.includes(tag)
    const enableReferenceExisting = affordance?.enableReferenceExisting ?? false
    const enableImport = affordance?.enableImport ?? canImport
    const addButtonLabel = affordance?.addLabel ?? `Add ${tag}`
    const refExistingLabel = affordance?.referenceExistingLabel ?? `Reference existing ${tag}`

    const updateReferenceList = useCallback(
        (mutate: (ctx: { referenceList: ReferenceList; standardForm: StandardForm }) => void) => {
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const descriptor = listContext(draft)
                    if (descriptor) {
                        mutate({
                            referenceList: descriptor.referenceList,
                            standardForm: draft
                        })
                    }
                    return draft
                }
            })
        },
        [updateStandard, listContext]
    )

    const referenceList = useMemo(() => {
        const descriptor = listContext(standardForm)
        return descriptor?.referenceList ?? new ReferenceList([])
    }, [listContext, standardForm])

    const items = useMemo(() => {
        const baseItems = referenceListToItems({
            referenceList,
            standardForm,
            tag
        })
        return icon ? baseItems.map((item) => ({ ...item, icon })) : baseItems
    }, [referenceList, standardForm, tag, icon])

    const summary = useMemo(() => {
        if (!items.length) return undefined
        return items.map(({ title: t }) => t).filter(Boolean).join(", ")
    }, [items])

    const handleCreateNew = useCallback(() => {
        if (disabled) return
        const enforceKey = enforceTypedKey(
            tag.toUpperCase() as "ASSET" | "CHARACTER" | "ROOM" | "EXAMPLE" | "FEATURE" | "KNOWLEDGE" | "MAP" | "MESSAGE" | "MOMENT" | "IMAGE" | "MARK" | "LENS"
        )
        const uuid = tag === "Example" ? `example-${Date.now()}` : uuidv4()
        const universalKey = enforceKey(uuid) as ComponentUUID

        updateStandard({
            type: "update",
            update: (draft: StandardForm) => {
                const descriptor = listContext(draft)
                if (!descriptor) return draft
                const { referenceList: refList, setReferenceList } = descriptor
                const component = standardComponentFactory({ tag, universalKey })
                if (!component) return draft
                draft.byUniversalId[universalKey] = component
                const reference = new StandardReference({ universalKey, tag })
                setReferenceList(refList.assureItem(reference))
                return draft
            }
        })
    }, [disabled, tag, updateStandard, listContext])

    const handleReferenceSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (disabled) return
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const descriptor = listContext(draft)
                    if (!descriptor) return draft
                    const { referenceList: refList, setReferenceList } = descriptor
                    const reference = new StandardReference({ universalKey, tag })
                    setReferenceList(refList.assureItem(reference))
                    return draft
                }
            })
            setSelectorOpen(false)
        },
        [disabled, tag, updateStandard, listContext]
    )

    const isExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            referenceList.payload.some((ref) => ref.universalKey === universalKey),
        [referenceList]
    )

    const handleImportSelect = useCallback(
        (fromAsset: AssetUUID, uuid: ComponentUUID, importTag: "Room" | "Feature" | "Knowledge" | "Map" | "Message" | "Moment") => {
            if (disabled) return
            dispatch(
                addImport({
                    assetId: AssetId,
                    fromAsset,
                    uuid,
                    tag: importTag,
                    addToReferenceList: listContext
                })
            )
            setImportDialogOpen(false)
        },
        [disabled, dispatch, AssetId, listContext]
    )

    const actionAffordances = useMemo(
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
                        <ListItemText primary={addButtonLabel} />
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
                            <ListItemText primary="Import" />
                        </ListItemButton>
                    </ListItem>
                )}
            </>
        ),
        [
            addButtonLabel,
            refExistingLabel,
            disabled,
            handleCreateNew,
            enableReferenceExisting,
            enableImport
        ]
    )

    return (
        <>
            <ReferenceListEditorGeneric
                title={title}
                items={items}
                summary={summary}
                defaultExpanded={defaultExpanded ?? !!items.length}
                disabled={disabled}
                variant={variant}
                onItemClick={onItemClick}
                updateReferenceList={updateReferenceList}
                actionAffordances={actionAffordances}
            />
            {enableReferenceExisting && (
                <ComponentSelectorDialog
                    open={selectorOpen}
                    onClose={() => setSelectorOpen(false)}
                    tag={tag}
                    onSelect={handleReferenceSelect}
                    isExcluded={isExcluded}
                />
            )}
            {enableImport && (
                <ImportComponentDialog
                    open={importDialogOpen}
                    onClose={() => setImportDialogOpen(false)}
                    assetId={AssetId}
                    onImportSelect={handleImportSelect}
                    tag={canImport ? (tag as "Room" | "Feature" | "Knowledge" | "Map" | "Moment" | "Message") : undefined}
                    isExcluded={isExcluded}
                />
            )}
        </>
    )
}

export default ReferenceListEditor
