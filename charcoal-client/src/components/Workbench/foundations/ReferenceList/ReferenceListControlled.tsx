import React, { FunctionComponent, ReactNode, useCallback, useMemo } from 'react'

import { ComponentUUID, isImportableTag } from '@tonylb/mtw-base/ts/schema'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { useAddReferenceImport } from './AddReferenceImportControl'
import { ReferenceListEditorGeneric } from './ReferenceListEditorGeneric'
import { referenceListToItems } from './referenceListAdapter'
import type { ComponentTag, ReferenceListAffordance } from './ReferenceListEditor'

export interface ReferenceListControlledProps {
    title: string
    referenceList: ReferenceList
    onReferenceListChange: (mutate: (list: ReferenceList) => void) => void
    tag: ComponentTag
    association: (ref: StandardReference, draft: StandardForm) => void
    requestCreate: (onCreated: (ref: StandardReference) => void) => void
    affordance?: ReferenceListAffordance
    variant?: 'contained' | 'table'
    icon?: ReactNode
    defaultExpanded?: boolean
    disabled?: boolean
    onItemClick?: (id: string) => void
    isExcludedExtra?: (universalKey: ComponentUUID) => boolean
    /** Session-mode: associate without updateStandard. */
    onAssociateReference?: (ref: StandardReference) => void
}

/**
 * Composable reference list shell (D6): referenceList + onReferenceListChange.
 * Persistence is wired by the parent (session updateComponent or asset updateStandard).
 */
export const ReferenceListControlled: FunctionComponent<ReferenceListControlledProps> = ({
    title,
    referenceList,
    onReferenceListChange,
    tag,
    association,
    requestCreate,
    affordance,
    variant = 'contained',
    icon,
    defaultExpanded,
    disabled: disabledProp,
    onItemClick,
    isExcludedExtra,
    onAssociateReference
}) => {
    const { standardForm, readonly: assetReadonly } = useWorkbenchAsset()
    const disabled = disabledProp ?? assetReadonly
    const enableReferenceExisting = affordance?.enableReferenceExisting ?? false
    const enableImport = affordance?.enableImport ?? isImportableTag(tag)
    const addButtonLabel = affordance?.addLabel ?? `Add ${tag}`
    const refExistingLabel = affordance?.referenceExistingLabel ?? `Reference existing ${tag}`

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
        return items.map(({ title: t }) => t).filter(Boolean).join(', ')
    }, [items])

    const isExcluded = useCallback(
        (universalKey: ComponentUUID) =>
            referenceList.payload.some((ref) => ref.universalKey === universalKey) ||
            (isExcludedExtra?.(universalKey) ?? false),
        [referenceList, isExcludedExtra]
    )

    const updateReferenceList = useCallback(
        (mutate: (ctx: { referenceList: ReferenceList; standardForm: StandardForm }) => void) => {
            if (disabled) {
                return
            }
            onReferenceListChange((list) => {
                mutate({ referenceList: list, standardForm })
            })
        },
        [disabled, onReferenceListChange, standardForm]
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
        onAssociateReference
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

export default ReferenceListControlled
