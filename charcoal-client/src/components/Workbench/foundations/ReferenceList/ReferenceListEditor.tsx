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
import ReferenceListControlled from "./ReferenceListControlled"

export type { ReferenceListItem } from "./ReferenceListEditorGeneric"

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

export interface ReferenceListAffordance {
    /** Override for Add button label; default "Add {tag}". */
    addLabel?: string
    /** When true, show "Reference existing {tag}" row that opens component selector. */
    enableReferenceExisting?: boolean
    /** When true, show "Import" row that opens import dialog. Defaults to true when tag is Room|Area|Feature|Knowledge|Map|Message. */
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
    variant?: 'contained' | 'table'
    icon?: React.ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
    /** Additional exclusion predicate for reference/import selectors. */
    isExcludedExtra?: (universalKey: ComponentUUID) => boolean
}

/**
 * Asset-mode reference list: listContext + updateStandard.
 * Thin wrapper over ReferenceListControlled for non-provider screens.
 */
export const ReferenceListEditor: FunctionComponent<ReferenceListEditorProps> = ({
    title,
    listContext,
    tag,
    affordance,
    variant = "contained",
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick,
    isExcludedExtra
}) => {
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const disabled = disabledProp ?? readonly

    const referenceList = useMemo(() => {
        const descriptor = listContext(standardForm)
        return descriptor?.referenceList ?? new ReferenceList([])
    }, [listContext, standardForm])

    const onReferenceListChange = useCallback(
        (mutate: (list: ReferenceList) => void) => {
            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const descriptor = listContext(draft)
                    if (descriptor) {
                        mutate(descriptor.referenceList)
                        descriptor.setReferenceList(descriptor.referenceList)
                    }
                    return draft
                }
            })
        },
        [updateStandard, listContext]
    )

    const association = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const descriptor = listContext(draft)
            if (descriptor) {
                descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
            }
        },
        [listContext]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (disabled) return
            const enforceKey = enforceTypedKey(
                tag.toUpperCase() as
                    | 'ASSET'
                    | 'AREA'
                    | 'CHARACTER'
                    | 'ROOM'
                    | 'FEATURE'
                    | 'KNOWLEDGE'
                    | 'MAP'
                    | 'MESSAGE'
                    | 'MOMENT'
                    | 'IMAGE'
                    | 'MARK'
                    | 'LENS'
                    | 'SITUATION'
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

    return (
        <ReferenceListControlled
            title={title}
            referenceList={referenceList}
            onReferenceListChange={onReferenceListChange}
            tag={tag}
            association={association}
            requestCreate={requestCreate}
            affordance={affordance}
            variant={variant}
            icon={icon}
            defaultExpanded={defaultExpanded}
            disabled={disabled}
            onItemClick={onItemClick}
            isExcludedExtra={isExcludedExtra}
        />
    )
}

export default ReferenceListEditor
