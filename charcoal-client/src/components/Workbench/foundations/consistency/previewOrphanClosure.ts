import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import { DevEnvironment } from '../../../../environment'
import {
    MAX_NORMALIZE_ITERATIONS,
    normalizeSinglePass
} from './normalizeWorkbenchDraft'

export type PreviewOrphanClosureOptions = {
    /** Apply pending local edits (disassociates, etc.) on the clone before simulating normalize. */
    applyLocal?: (draft: StandardForm) => void
}

export type PreviewOrphanClosureResult = {
    removedKeys: ComponentUUID[]
    includesNonEmpty: boolean
}

/**
 * Simulate workbench fixpoint orphan closure on a **local** draft clone (D5).
 * Does not mutate `localDraft`. Uses the same passes as `normalizeWorkbenchDraft`.
 */
export function previewOrphanClosure(
    localDraft: StandardForm,
    options?: PreviewOrphanClosureOptions
): PreviewOrphanClosureResult {
    const draft = localDraft._clone()
    options?.applyLocal?.(draft)

    const removedKeys: ComponentUUID[] = []
    let includesNonEmpty = false

    for (let i = 0; i < MAX_NORMALIZE_ITERATIONS; i++) {
        const removed = normalizeSinglePass(draft)
        if (removed.length === 0) {
            return { removedKeys, includesNonEmpty }
        }

        for (const component of removed) {
            if (!component.isEmpty()) {
                includesNonEmpty = true
            }
            const key = component.universalKey
            if (key) {
                removedKeys.push(key)
            }
        }

        if (i === MAX_NORMALIZE_ITERATIONS - 1) {
            if (DevEnvironment) {
                throw new Error('previewOrphanClosure exceeded iteration cap')
            }
            console.warn('previewOrphanClosure exceeded iteration cap')
        }
    }

    return { removedKeys, includesNonEmpty }
}
