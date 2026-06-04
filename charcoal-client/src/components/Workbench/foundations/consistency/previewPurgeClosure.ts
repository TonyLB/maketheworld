import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
export type PreviewPurgeClosureOptions = {
    /** Apply pending local edits on the clone before simulating purge. */
    applyLocal?: (draft: StandardForm) => void
}

export type PreviewPurgeClosureResult = {
    targetKey: ComponentUUID
    /** Bodies removed from _components when simulating purge with cascade. */
    bodiesRemoved: ComponentUUID[]
    /** Implicit descendants that remain after rehome (cascade: false). */
    bodiesRehomed: ComponentUUID[]
    /** Implicit descendants removed only under cascade. */
    bodiesCascadeDeleted: ComponentUUID[]
    includesNonEmpty: boolean
    needsDescendantChoice: boolean
}

function componentUniversalKeys(form: StandardForm): Set<ComponentUUID> {
    const keys = new Set<ComponentUUID>()
    for (const component of form._components) {
        const key = component.universalKey
        if (key) {
            keys.add(key)
        }
    }
    return keys
}

function keysToSortedArray(keys: Set<ComponentUUID>): ComponentUUID[] {
    return [...keys].sort()
}

function emptyPreviewResult(targetKey: ComponentUUID): PreviewPurgeClosureResult {
    return {
        targetKey,
        bodiesRemoved: [],
        bodiesRehomed: [],
        bodiesCascadeDeleted: [],
        includesNonEmpty: false,
        needsDescendantChoice: false
    }
}

function resolveTargetKey(reference: StandardReference, before: StandardForm): ComponentUUID | undefined {
    const component = before._lookup(reference.standardKey.toJSON())
    return component?.universalKey
}

function includesNonEmptyAmong(
    before: StandardForm,
    keys: Iterable<ComponentUUID>
): boolean {
    const keySet = new Set(keys)
    for (const component of before._components) {
        const key = component.universalKey
        if (key && keySet.has(key) && !component.isEmpty()) {
            return true
        }
    }
    return false
}

/**
 * Simulate purge (removeComponent) on a **local** draft clone.
 * Does not mutate `localDraft`.
 */
export function previewPurgeClosure(
    localDraft: StandardForm,
    reference: StandardReference,
    options?: PreviewPurgeClosureOptions
): PreviewPurgeClosureResult {
    const before = localDraft._clone()
    options?.applyLocal?.(before)

    const targetKey = resolveTargetKey(reference, before)
    if (!targetKey) {
        const fallback = reference.universalKey
        if (fallback) {
            return emptyPreviewResult(fallback)
        }
        throw new Error('previewPurgeClosure requires a reference with universalKey or an existing target body')
    }

    const beforeKeys = componentUniversalKeys(before)
    const afterRehome = before.removeComponent(reference, { cascade: false })
    const afterCascade = before.removeComponent(reference, { cascade: true })
    const afterRehomeKeys = componentUniversalKeys(afterRehome)
    const afterCascadeKeys = componentUniversalKeys(afterCascade)

    const bodiesRemoved = keysToSortedArray(
        new Set([...beforeKeys].filter((k) => !afterCascadeKeys.has(k)))
    )

    /** Bodies that rehome keeps but cascade removes (includes ref={0} stubs not in implicitDescendants). */
    const bodiesRehomed = keysToSortedArray(
        new Set([...afterRehomeKeys].filter((k) => !afterCascadeKeys.has(k)))
    )

    const bodiesCascadeDeleted = [...bodiesRehomed]

    const includesNonEmpty = includesNonEmptyAmong(before, [
        ...bodiesRemoved,
        ...bodiesRehomed
    ])

    return {
        targetKey,
        bodiesRemoved,
        bodiesRehomed,
        bodiesCascadeDeleted,
        includesNonEmpty,
        needsDescendantChoice: bodiesRehomed.length > 0
    }
}
