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
import type { ComponentTag, ReferenceListAffordance } from "./ReferenceListEditor"
import ReferenceListControlled from "./ReferenceListControlled"

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
    variant?: 'contained' | 'table'
    icon?: ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
    isExcludedExtra?: (universalKey: ComponentUUID) => boolean
}

/**
 * Context-only reference list editor for WorkbenchComponentProvider sessions.
 * Thin wrapper over ReferenceListControlled; listAccessor maps to referenceList +
 * onReferenceListChange on parent working.
 */
export const ReferenceListSessionEditor = <T extends StandardComponent>({
    title,
    listAccessor,
    tag,
    affordance,
    variant = 'contained',
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick,
    isExcludedExtra
}: ReferenceListSessionEditorProps<T>): React.ReactElement | null => {
    const {
        working,
        updateComponent,
        commitAssetScopedUpdate,
        readonly: sessionReadonly,
        missing
    } = useWorkbenchComponent<T>()

    const disabled = disabledProp ?? sessionReadonly

    const referenceList = useMemo(() => {
        if (!working) {
            return new ReferenceList([])
        }
        return listAccessor.getReferenceList(working)
    }, [working, listAccessor])

    const onReferenceListChange = useCallback(
        (mutate: (list: ReferenceList) => void) => {
            if (disabled || missing) {
                return
            }
            updateComponent((draft) => {
                const list = listAccessor.getReferenceList(draft)
                mutate(list)
                listAccessor.setReferenceList(draft, list)
            })
        },
        [disabled, missing, updateComponent, listAccessor]
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

    if (missing || !working) {
        return null
    }

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
            onAssociateReference={onAssociateReference}
            persistDraftUpdate={persistDraftUpdate}
        />
    )
}

export default ReferenceListSessionEditor as FunctionComponent<
    ReferenceListSessionEditorProps<StandardComponent>
>
