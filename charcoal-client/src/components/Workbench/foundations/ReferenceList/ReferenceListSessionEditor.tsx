import React, { FunctionComponent, ReactNode, useCallback, useMemo } from "react"

import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { standardComponentFactory } from "@tonylb/mtw-wml/ts/standardize/componentFactory"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { v4 as uuidv4 } from "uuid"

import { useWorkbenchComponent } from "../WorkbenchComponent"
import { useWorkbenchAsset } from "../useWorkbenchAsset"
import { useAddReferenceImport } from "./AddReferenceImportControl"
import { ReferenceListEditorGeneric } from "./ReferenceListEditorGeneric"
import { referenceListToItems } from "./referenceListAdapter"
import type { ComponentTag, ReferenceListAffordance } from "./ReferenceListEditor"

export type ReferenceListSessionAccessor<T extends StandardComponent> = {
    getReferenceList: (parent: T) => ReferenceList
    setReferenceList: (parent: T, list: ReferenceList) => void
}

const assureReferenceOnParent = <T extends StandardComponent>(
    parent: T,
    accessor: ReferenceListSessionAccessor<T>,
    ref: StandardReference
): void => {
    accessor.setReferenceList(parent, accessor.getReferenceList(parent).assureItem(ref))
}

export interface ReferenceListSessionEditorProps<T extends StandardComponent = StandardComponent> {
    title: string
    listAccessor: ReferenceListSessionAccessor<T>
    tag: ComponentTag
    affordance?: ReferenceListAffordance
    variant?: "contained" | "table"
    icon?: ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
    isExcludedExtra?: (universalKey: ComponentUUID) => boolean
}

const IMPORTABLE_TAGS: ComponentTag[] = [
    "Room",
    "Area",
    "Feature",
    "Knowledge",
    "Map",
    "Message"
]

/**
 * Context-only reference list editor for WorkbenchComponentProvider sessions (D15).
 * Requires WorkbenchComponentProvider; call site supplies listAccessor (site-specific
 * get/set on parent working). List-only mutations via updateComponent; create/import
 * via commitAssetScopedUpdate (no per-action updateStandard on edit path).
 */
export const ReferenceListSessionEditor = <T extends StandardComponent>({
    title,
    listAccessor,
    tag,
    affordance,
    variant = "contained",
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick,
    isExcludedExtra
}: ReferenceListSessionEditorProps<T>): React.ReactElement | null => {
    const { standardForm } = useWorkbenchAsset()
    const {
        working,
        updateComponent,
        commitAssetScopedUpdate,
        readonly: sessionReadonly,
        missing
    } = useWorkbenchComponent<T>()

    const disabled = disabledProp ?? sessionReadonly
    const canImport = IMPORTABLE_TAGS.includes(tag)
    const enableReferenceExisting = affordance?.enableReferenceExisting ?? false
    const enableImport = affordance?.enableImport ?? canImport
    const addButtonLabel = affordance?.addLabel ?? `Add ${tag}`
    const refExistingLabel = affordance?.referenceExistingLabel ?? `Reference existing ${tag}`

    const referenceList = useMemo(() => {
        if (!working) {
            return new ReferenceList([])
        }
        return listAccessor.getReferenceList(working)
    }, [working, listAccessor])

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
            referenceList.payload.some((ref) => ref.universalKey === universalKey) ||
            (isExcludedExtra?.(universalKey) ?? false),
        [referenceList, isExcludedExtra]
    )

    const updateReferenceList = useCallback(
        (mutate: (ctx: { referenceList: ReferenceList; standardForm: StandardForm }) => void) => {
            if (disabled || missing) {
                return
            }
            updateComponent((draft) => {
                const list = listAccessor.getReferenceList(draft)
                mutate({ referenceList: list, standardForm })
                listAccessor.setReferenceList(draft, list)
            })
        },
        [disabled, missing, updateComponent, listAccessor, standardForm]
    )

    const onAssociateReference = useCallback(
        (ref: StandardReference) => {
            if (disabled || missing) {
                return
            }
            updateComponent((draft) => {
                assureReferenceOnParent(draft, listAccessor, ref)
            })
        },
        [disabled, missing, updateComponent, listAccessor]
    )

    const persistDraftUpdate = useCallback(
        (update: (draft: StandardForm) => void) => {
            if (disabled || missing) {
                return
            }
            commitAssetScopedUpdate((draft) => {
                update(draft)
            })
        },
        [disabled, missing, commitAssetScopedUpdate]
    )

    const association = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            if (!working?.universalKey) {
                return
            }
            const parentInDraft = draft.byUniversalId[working.universalKey]
            if (parentInDraft) {
                assureReferenceOnParent(parentInDraft as T, listAccessor, ref)
            }
        },
        [working, listAccessor]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (disabled || missing) {
                return
            }
            const enforceKey = enforceTypedKey(
                tag.toUpperCase() as
                    | "ASSET"
                    | "AREA"
                    | "CHARACTER"
                    | "ROOM"
                    | "FEATURE"
                    | "KNOWLEDGE"
                    | "MAP"
                    | "MESSAGE"
                    | "MOMENT"
                    | "IMAGE"
                    | "MARK"
                    | "LENS"
                    | "SITUATION"
            )
            const uuid = tag === "Situation" ? `situation-${Date.now()}` : uuidv4()
            const universalKey = enforceKey(uuid) as ComponentUUID
            const reference = new StandardReference({ universalKey, tag })

            onCreated(reference)

            commitAssetScopedUpdate((draft) => {
                const { component } = standardComponentFactory({ tag, universalKey })
                if (component) {
                    draft.byUniversalId[universalKey] = component
                }
            })
        },
        [disabled, missing, tag, commitAssetScopedUpdate]
    )

    const { actionRows, selectorDialog, importDialog } = useAddReferenceImport({
        tag,
        isExcluded,
        association,
        requestCreate,
        labels: { add: addButtonLabel, referenceExisting: refExistingLabel },
        enableReferenceExisting,
        enableImport,
        disabled,
        onAssociateReference,
        persistDraftUpdate
    })

    if (missing || !working) {
        return null
    }

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

export default ReferenceListSessionEditor as FunctionComponent<
    ReferenceListSessionEditorProps<StandardComponent>
>
