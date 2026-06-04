import type { AppDispatch } from '../../../../store'
import { pushChoice } from '../../../../slices/UI/choiceDialog'
import type StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

import type { PreviewPurgeClosureResult } from './previewPurgeClosure'

export type PurgeDisposition = 'cancel' | 'rehome' | 'cascade'

export type ConfirmPurgeBeforeRemoveParams = {
    dispatch: AppDispatch
    reference: StandardReference
    preview: PreviewPurgeClosureResult
    /** Optional display label for dialog copy (defaults to target key). */
    targetLabel?: string
}

const PURGE_TITLE = 'Remove component from asset?'
const PURGE_TITLE_WITH_DESCENDANTS = 'Remove component and descendants?'

function formatKeyList(keys: string[]): string {
    if (keys.length === 0) {
        return ''
    }
    if (keys.length === 1) {
        return keys[0]
    }
    if (keys.length === 2) {
        return `${keys[0]} and ${keys[1]}`
    }
    const rest = keys.slice(0, -1).join(', ')
    return `${rest}, and ${keys[keys.length - 1]}`
}

function shortLabelForKey(key: string): string {
    const hash = key.indexOf('#')
    return hash >= 0 ? key.slice(hash + 1) : key
}

function buildDescendantChoiceMessage(
    targetLabel: string,
    preview: PreviewPurgeClosureResult
): string {
    const rehomed = preview.bodiesRehomed.map(shortLabelForKey)
    const cascadeDeleted = preview.bodiesCascadeDeleted.map(shortLabelForKey)
    const rehomedList = formatKeyList(rehomed)
    const cascadeList = formatKeyList(cascadeDeleted)
    return (
        `Removing "${targetLabel}" would rehome ${rehomedList} to the asset top level, ` +
        `or delete ${cascadeList} with the component.`
    )
}

function buildSimplePurgeMessage(targetLabel: string, preview: PreviewPurgeClosureResult): string {
    const removed = preview.bodiesRemoved.map(shortLabelForKey)
    const removedList = formatKeyList(removed)
    return `Remove "${targetLabel}" from this asset? This will remove ${removedList} and scrub references on other components.`
}

/**
 * Confirm explicit purge (removeComponent) before dispatch.
 * Returns the author's disposition; empty-only purge proceeds without a dialog.
 */
export async function confirmPurgeBeforeRemove({
    dispatch,
    preview,
    targetLabel
}: ConfirmPurgeBeforeRemoveParams): Promise<PurgeDisposition> {
    const label = targetLabel ?? shortLabelForKey(preview.targetKey)

    if (!preview.includesNonEmpty && !preview.needsDescendantChoice) {
        return 'cascade'
    }

    if (preview.needsDescendantChoice) {
        const choice = await pushChoice({
            title: PURGE_TITLE_WITH_DESCENDANTS,
            message: buildDescendantChoiceMessage(label, preview),
            options: [
                { label: 'Cancel', returnValue: 'cancel' },
                { label: 'Rehome', returnValue: 'rehome' },
                { label: 'Cascade delete', returnValue: 'cascade' }
            ]
        })(dispatch)

        if (choice === 'rehome' || choice === 'cascade') {
            return choice
        }
        return 'cancel'
    }

    const choice = await pushChoice({
        title: PURGE_TITLE,
        message: buildSimplePurgeMessage(label, preview),
        options: [
            { label: 'Cancel', returnValue: 'cancel' },
            { label: 'Remove', returnValue: 'cascade' }
        ]
    })(dispatch)

    return choice === 'cascade' ? 'cascade' : 'cancel'
}
