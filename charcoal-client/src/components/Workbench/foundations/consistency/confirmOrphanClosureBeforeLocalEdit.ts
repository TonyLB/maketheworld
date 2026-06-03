import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { AppDispatch } from '../../../../store'
import { pushChoice } from '../../../../slices/UI/choiceDialog'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import {
    applyWorkingAssetMetaToDraft,
    applyWorkingComponentToDraft,
    type WorkbenchAssetMetaWorking
} from '../workbenchMutations'
import { removeReferenceFromListById } from '../ReferenceList/referenceListMutations'
import { previewOrphanClosure } from './previewOrphanClosure'

const ORPHAN_REMOVE_TITLE = 'Remove component?'
const ORPHAN_REMOVE_MESSAGE =
    'Removing this reference will also remove the component and all its contents.'

export type ConfirmOrphanClosureBeforeAssetMetaDisassociateParams = {
    dispatch: AppDispatch
    localStandardForm: StandardForm
    working: WorkbenchAssetMetaWorking
    removeId: string
}

/**
 * Preview fixpoint orphan closure for a pending top-level disassociate (D5).
 * Returns true when the caller should proceed with the local disassociate.
 */
export async function confirmOrphanClosureBeforeAssetMetaDisassociate({
    dispatch,
    localStandardForm,
    working,
    removeId
}: ConfirmOrphanClosureBeforeAssetMetaDisassociateParams): Promise<boolean> {
    const preview = previewOrphanClosure(localStandardForm._clone(), {
        applyLocal: (draft) => {
            const simulated: WorkbenchAssetMetaWorking = {
                shortName: working.shortName?.clone(),
                summary: working.summary?.clone(),
                topLevel: working.topLevel.clone()
            }
            removeReferenceFromListById(simulated.topLevel, removeId)
            applyWorkingAssetMetaToDraft(draft, simulated)
        }
    })

    if (!preview.includesNonEmpty) {
        return true
    }

    const choice = await pushChoice({
        title: ORPHAN_REMOVE_TITLE,
        message: ORPHAN_REMOVE_MESSAGE,
        options: [
            { label: 'Cancel', returnValue: 'cancel' },
            { label: 'Remove', returnValue: 'confirm' }
        ]
    })(dispatch)

    return choice === 'confirm'
}

export type ConfirmOrphanClosureBeforeComponentDisassociateParams<
    T extends StandardComponent = StandardComponent
> = {
    dispatch: AppDispatch
    localStandardForm: StandardForm
    componentId: ComponentUUID
    working: T
    applyDisassociateOnWorking: (simulated: T) => void
}

/**
 * Preview fixpoint orphan closure for a pending component-session disassociate (D5).
 * Returns true when the caller should proceed with the local disassociate.
 */
export async function confirmOrphanClosureBeforeComponentDisassociate<
    T extends StandardComponent = StandardComponent
>({
    dispatch,
    localStandardForm,
    componentId,
    working,
    applyDisassociateOnWorking
}: ConfirmOrphanClosureBeforeComponentDisassociateParams<T>): Promise<boolean> {
    const preview = previewOrphanClosure(localStandardForm._clone(), {
        applyLocal: (draft) => {
            const simulated = working.clone() as T
            applyDisassociateOnWorking(simulated)
            applyWorkingComponentToDraft(draft, componentId, simulated)
        }
    })

    if (!preview.includesNonEmpty) {
        return true
    }

    const choice = await pushChoice({
        title: ORPHAN_REMOVE_TITLE,
        message: ORPHAN_REMOVE_MESSAGE,
        options: [
            { label: 'Cancel', returnValue: 'cancel' },
            { label: 'Remove', returnValue: 'confirm' }
        ]
    })(dispatch)

    return choice === 'confirm'
}
