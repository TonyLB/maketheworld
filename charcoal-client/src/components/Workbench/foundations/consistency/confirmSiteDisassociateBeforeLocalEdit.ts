import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { AppDispatch } from '../../../../store'
import { pushChoice } from '../../../../slices/UI/choiceDialog'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import { componentDisplayLabel } from '../../../../lib/componentDisplayLabel'
import {
    applyWorkingAssetMetaToDraft,
    applyWorkingComponentToDraft,
    type WorkbenchAssetMetaWorking
} from '../workbenchMutations'
import { removeReferenceFromListById } from '../ReferenceList/referenceListMutations'

const DISASSOCIATE_TITLE = 'Remove link?'
const CHOICE_CANCEL = 'cancel'
const CHOICE_CONFIRM = 'confirm'

function formatReferrerList(
    referrers: StandardReference[],
    standardForm: StandardForm
): string {
    const labels = referrers.map((ref) => {
        const key = ref.universalKey as ComponentUUID | undefined
        if (!key) {
            return 'Untitled'
        }
        const comp = standardForm.byUniversalId[key]
        if (!comp) {
            return 'Untitled'
        }
        return componentDisplayLabel(comp, { standardForm, fallbackLabel: 'Untitled' }) ?? 'Untitled'
    })
    if (labels.length === 0) {
        return ''
    }
    if (labels.length === 1) {
        return labels[0]
    }
    if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`
    }
    const rest = labels.slice(0, -1).join(', ')
    return `${rest}, and ${labels[labels.length - 1]}`
}

function targetLabelForReference(
    target: StandardReference,
    standardForm: StandardForm
): string {
    const key = target.universalKey as ComponentUUID | undefined
    if (key) {
        const comp = standardForm.byUniversalId[key]
        if (comp) {
            return (
                componentDisplayLabel(comp, { standardForm, fallbackLabel: 'Untitled' }) ??
                'Untitled'
            )
        }
    }
    const keyPart = target.key
    if (typeof keyPart === 'string' && keyPart.trim()) {
        return keyPart
    }
    return target.universalKey ?? 'this component'
}

function isEmptyLocalBody(localStandardForm: StandardForm, target: StandardReference): boolean {
    const key = target.universalKey as ComponentUUID | undefined
    if (!key) {
        return true
    }
    const comp = localStandardForm.byUniversalId[key]
    if (!comp) {
        return true
    }
    return comp.isEmpty()
}

function buildDisassociateMessage(params: {
    targetLabel: string
    siteLabel: string
    remaining: StandardReference[]
    standardForm: StandardForm
    includePurgeHint: boolean
}): string {
    const { targetLabel, siteLabel, remaining, standardForm, includePurgeHint } = params
    const retention =
        `The component will remain in this asset and may still appear at the asset level.`
    const purgeHint = includePurgeHint
        ? ' Use Purge on the Components list to remove it entirely.'
        : ''
    if (remaining.length === 0) {
        return (
            `Remove "${targetLabel}" from ${siteLabel}? ` +
            `${retention}${purgeHint}`
        )
    }
    const referrerList = formatReferrerList(remaining, standardForm)
    return (
        `Remove "${targetLabel}" from ${siteLabel}? ` +
        `${retention} It is still referenced from ${referrerList}.`
    )
}

async function confirmSiteDisassociate({
    dispatch,
    localStandardForm,
    standardForm,
    target,
    siteLabel,
    applyLocal,
    includePurgeHint
}: {
    dispatch: AppDispatch
    localStandardForm: StandardForm
    standardForm: StandardForm
    target: StandardReference
    siteLabel: string
    applyLocal: (draft: StandardForm) => void
    includePurgeHint: boolean
}): Promise<boolean> {
    if (isEmptyLocalBody(localStandardForm, target)) {
        return true
    }

    const simulated = localStandardForm._clone()
    applyLocal(simulated)
    const remaining = simulated.referencedBy(target)

    const message = buildDisassociateMessage({
        targetLabel: targetLabelForReference(target, standardForm),
        siteLabel,
        remaining,
        standardForm,
        includePurgeHint
    })

    const choice = await pushChoice({
        title: DISASSOCIATE_TITLE,
        message,
        options: [
            { label: 'Cancel', returnValue: CHOICE_CANCEL },
            { label: 'Remove link', returnValue: CHOICE_CONFIRM }
        ]
    })(dispatch)

    return choice === CHOICE_CONFIRM
}

export type ConfirmSiteDisassociateBeforeAssetMetaDisassociateParams = {
    dispatch: AppDispatch
    localStandardForm: StandardForm
    standardForm: StandardForm
    working: WorkbenchAssetMetaWorking
    removeId: string
}

/**
 * Confirm a pending top-level (_topLevel) disassociate before mutating session working.
 * Does not simulate normalize or body deletion.
 */
export async function confirmSiteDisassociateBeforeAssetMetaDisassociate({
    dispatch,
    localStandardForm,
    standardForm,
    working,
    removeId
}: ConfirmSiteDisassociateBeforeAssetMetaDisassociateParams): Promise<boolean> {
    const target =
        working.topLevel.payload.find(
            (ref) => ref.universalKey === removeId || ref.key === removeId
        ) ?? new StandardReference(removeId as ComponentUUID)

    return confirmSiteDisassociate({
        dispatch,
        localStandardForm,
        standardForm,
        target,
        siteLabel: 'the Components list',
        includePurgeHint: true,
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
}

export type ConfirmSiteDisassociateBeforeComponentDisassociateParams<
    T extends StandardComponent = StandardComponent
> = {
    dispatch: AppDispatch
    localStandardForm: StandardForm
    standardForm: StandardForm
    componentId: ComponentUUID
    working: T
    target: StandardReference
    siteLabel: string
    applyDisassociateOnWorking: (simulated: T) => void
}

/**
 * Confirm a pending component-session disassociate (e.g. Room lens, situations list).
 */
export async function confirmSiteDisassociateBeforeComponentDisassociate<
    T extends StandardComponent = StandardComponent
>({
    dispatch,
    localStandardForm,
    standardForm,
    componentId,
    working,
    target,
    siteLabel,
    applyDisassociateOnWorking
}: ConfirmSiteDisassociateBeforeComponentDisassociateParams<T>): Promise<boolean> {
    return confirmSiteDisassociate({
        dispatch,
        localStandardForm,
        standardForm,
        target,
        siteLabel,
        includePurgeHint: false,
        applyLocal: (draft) => {
            const simulated = working.clone() as T
            applyDisassociateOnWorking(simulated)
            applyWorkingComponentToDraft(draft, componentId, simulated)
        }
    })
}
