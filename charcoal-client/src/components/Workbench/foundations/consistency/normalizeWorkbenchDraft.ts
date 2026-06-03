import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import { DevEnvironment } from '../../../../environment'
import { isReferencedInAssetLayer } from './isReferencedInAssetLayer'

export const MAX_NORMALIZE_ITERATIONS = 50

/** Keys in `_components` with no asset-layer reference per D2. */
export function findOrphanComponents(draft: StandardForm): StandardComponent[] {
    return draft._components.filter(
        (component) => !isReferencedInAssetLayer(draft, component.reference)
    )
}

/**
 * Defensive ref scrub after orphan body removal. Expected no-op on happy path;
 * see foundations/consistency/AGENT.md (Ref scrub belt-and-suspenders).
 */
export function scrubReferences(
    draft: StandardForm,
    referencesToRemove: StandardReference[]
): void {
    draft._components = draft._components.map((component) =>
        component.removeReferences(referencesToRemove)
    )

    if (draft._topLevel) {
        const filteredTopLevel = draft._topLevel.payload.filter(
            (ref) => !referencesToRemove.some((removedRef) => ref.sameKey(removedRef))
        )
        draft._topLevel =
            filteredTopLevel.length > 0 ? new ReferenceList(filteredTopLevel) : undefined
    }
}

/** One normalize pass: orphan detect, body removal, ref scrub. Returns bodies removed. */
export function normalizeSinglePass(draft: StandardForm): number {
    const componentsToRemove = findOrphanComponents(draft)
    if (componentsToRemove.length === 0) {
        return 0
    }

    draft._components = draft._components.filter(
        (component) =>
            !componentsToRemove.some((removed) => removed.standardKey.equals(component.standardKey))
    )

    const referencesToRemove = componentsToRemove.map((c) => c.reference)
    scrubReferences(draft, referencesToRemove)

    draft.invalidateCache()
    draft.validate()

    return componentsToRemove.length
}

/**
 * Workbench orphan GC on the **local** draft (D3, D4). Fixpoint loop using D2
 * (`isReferencedInAssetLayer`); removes empty and non-empty orphans. Mutates
 * `draft` in place.
 */
export function normalizeWorkbenchDraft(draft: StandardForm): StandardForm {
    for (let i = 0; i < MAX_NORMALIZE_ITERATIONS; i++) {
        const removedCount = normalizeSinglePass(draft)
        if (removedCount === 0) {
            return draft
        }
        if (i === MAX_NORMALIZE_ITERATIONS - 1) {
            if (DevEnvironment) {
                throw new Error('normalizeWorkbenchDraft exceeded iteration cap')
            }
            console.warn('normalizeWorkbenchDraft exceeded iteration cap')
        }
    }
    return draft
}
