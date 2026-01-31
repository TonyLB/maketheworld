import React, { FunctionComponent, ReactNode, useCallback, useMemo, useState } from "react"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import AddIcon from "@mui/icons-material/Add"

import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { ReferenceListEditorGeneric } from "./ReferenceListEditorGeneric"
import { referenceListToItems } from "./referenceListAdapter"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { standardComponentFactory } from "@tonylb/mtw-wml/ts/standardize/componentFactory"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"

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

export interface ListContextDescriptor {
    referenceList: ReferenceList
    setReferenceList: (list: ReferenceList) => void
}

export interface ReferenceListEditorProps {
    title: string
    listContext: (form: StandardForm) => ListContextDescriptor | null
    tag: ComponentTag
    addAffordance: "create" | "dialog" | ReactNode
    addDialogRenderer?: (props: {
        open: boolean
        onClose: () => void
        onSelectExisting: (universalKey: ComponentUUID) => void
        onCreateNew: () => void
    }) => ReactNode
    addLabel?: string
    emptyStateText?: string
    variant?: "contained" | "table"
    icon?: ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
}

export const ReferenceListEditor: FunctionComponent<ReferenceListEditorProps> = ({
    title,
    listContext,
    tag,
    addAffordance,
    addDialogRenderer,
    addLabel = "Add",
    emptyStateText,
    variant = "contained",
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick
}) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const [dialogOpen, setDialogOpen] = useState(false)
    const disabled = disabledProp ?? readonly

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

    const handleSelectExisting = useCallback(
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
        },
        [disabled, tag, updateStandard, listContext]
    )

    const actionAffordances = useMemo(() => {
        if (addAffordance === "create") {
            return (
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
            )
        }
        if (addAffordance === "dialog" && addDialogRenderer) {
            return (
                <>
                    <ListItem>
                        <ListItemButton
                            onClick={() => setDialogOpen(true)}
                            disabled={disabled}
                            sx={{ justifyContent: "center" }}
                        >
                            <ListItemIcon>
                                <AddIcon />
                            </ListItemIcon>
                            <ListItemText primary={addLabel} />
                        </ListItemButton>
                    </ListItem>
                    {addDialogRenderer({
                        open: dialogOpen,
                        onClose: () => setDialogOpen(false),
                        onSelectExisting: (uk) => {
                            handleSelectExisting(uk)
                            setDialogOpen(false)
                        },
                        onCreateNew: () => {
                            handleCreateNew()
                            setDialogOpen(false)
                        }
                    })}
                </>
            )
        }
        if (React.isValidElement(addAffordance)) {
            return addAffordance
        }
        return null
    }, [addAffordance, addDialogRenderer, addLabel, disabled, dialogOpen, handleCreateNew, handleSelectExisting])

    return (
        <ReferenceListEditorGeneric
            title={title}
            items={items}
            summary={summary}
            defaultExpanded={defaultExpanded ?? !!items.length}
            disabled={disabled}
            variant={variant}
            emptyStateText={emptyStateText}
            onItemClick={onItemClick}
            updateReferenceList={updateReferenceList}
            actionAffordances={actionAffordances}
        />
    )
}

export default ReferenceListEditor
