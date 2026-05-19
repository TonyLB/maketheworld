import React, { FunctionComponent, ReactNode, useCallback, useMemo } from "react"

import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { type ReferenceListDescriptor } from "../../../../slices/personalAssets"
import { useAddReferenceImport } from "./AddReferenceImportControl"
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
    | "Guidance"
    | "Situation"
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
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const disabled = disabledProp ?? readonly
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

    const isExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            referenceList.payload.some((ref) => ref.universalKey === universalKey),
        [referenceList]
    )

    const association = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const descriptor = listContext(draft)
            if (descriptor) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
        },
        [listContext]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (disabled) return
            const enforceKey = enforceTypedKey(
                tag.toUpperCase() as "ASSET" | "CHARACTER" | "ROOM" | "FEATURE" | "KNOWLEDGE" | "MAP" | "MESSAGE" | "MOMENT" | "IMAGE" | "MARK" | "LENS" | "SITUATION"
            )
            const uuid = tag === "Situation" ? `situation-${Date.now()}` : uuidv4()
            const universalKey = enforceKey(uuid) as ComponentUUID
            const reference = new StandardReference({ universalKey, tag })

            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const { component } = standardComponentFactory({ tag, universalKey })
                    if (!component) return draft
                    draft.byUniversalId[universalKey] = component
                    return draft
                }
            })
            onCreated(reference)
        },
        [disabled, tag, updateStandard]
    )

    const { actionRows, selectorDialog, importDialog } = useAddReferenceImport({
        tag,
        isExcluded,
        association,
        requestCreate,
        labels: { add: addButtonLabel, referenceExisting: refExistingLabel },
        enableReferenceExisting,
        enableImport,
        disabled
    })

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
                actionAffordances={actionRows}
            />
            {selectorDialog}
            {importDialog}
        </>
    )
}

export default ReferenceListEditor
