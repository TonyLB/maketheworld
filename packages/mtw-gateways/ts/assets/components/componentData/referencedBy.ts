import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardComponentReferenceKey } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/keys/reference'

export type PersistedReferencedByEntry = {
    referrerUniversalKey: ComponentUUID
    referenceType?: StandardComponentReferenceKey['referenceType']
}

const entryKey = (entry: PersistedReferencedByEntry): string =>
    `${entry.referrerUniversalKey}:${entry.referenceType ?? ''}`

export const unionReferencedByAcrossParticipation = (
    byAssets: ReadonlyArray<{ AssetId: AssetUUID; referencedBy?: PersistedReferencedByEntry[] }>,
    mergeParticipationOrder: readonly AssetUUID[]
): PersistedReferencedByEntry[] => {
    const seen = new Set<string>()
    const result: PersistedReferencedByEntry[] = []
    for (const assetId of mergeParticipationOrder) {
        const row = byAssets.find((entry) => entry.AssetId === assetId)
        for (const entry of row?.referencedBy ?? []) {
            const key = entryKey(entry)
            if (!seen.has(key)) {
                seen.add(key)
                result.push(entry)
            }
        }
    }
    return result
}

const referenceForTarget = (targetUniversalKey: ComponentUUID): StandardReference => {
    const tag = targetUniversalKey.split('#')[0] as StandardReference['tag']
    return new StandardReference({ tag, universalKey: targetUniversalKey })
}

const entryForReferrer = (
    fileAsset: StandardForm,
    targetRef: StandardReference,
    referrerRef: StandardReference
): PersistedReferencedByEntry | undefined => {
    const referrerUniversalKey = referrerRef.universalKey
    if (!referrerUniversalKey) {
        return undefined
    }
    const mappings = fileAsset._components.map((component) => component.reference)
    const referrerComponent = fileAsset._lookup(referrerUniversalKey)?.withMapping(mappings)
    const matchingKeys =
        referrerComponent?.referencedKeys().filter(({ reference }) => reference.sameKey(targetRef)) ?? []
    const referenceType =
        matchingKeys.find(({ referenceType: type }) => type === 'Edge')?.referenceType ??
        matchingKeys[0]?.referenceType
    return {
        referrerUniversalKey,
        ...(referenceType ? { referenceType } : {}),
    }
}

export const collectReferencedTargetsInAsset = (fileAsset: StandardForm): ComponentUUID[] => {
    const mappings = fileAsset._components.map((component) => component.reference)
    const targets = new Set<ComponentUUID>()
    for (const component of fileAsset._components) {
        for (const { reference } of component.withMapping(mappings).referencedKeys()) {
            const universalKey = reference.universalKey ?? reference.standardKey.universalKey
            if (universalKey) {
                targets.add(universalKey)
            }
        }
    }
    return [...targets]
}

/**
 * Recompute persisted inverse index for one asset's file view.
 * Keys are target universal ids; values are colocated `referencedBy` lists.
 */
export const buildReferencedByPatchesForAsset = (
    fileAsset: StandardForm
): Map<ComponentUUID, PersistedReferencedByEntry[]> => {
    const patches = new Map<ComponentUUID, PersistedReferencedByEntry[]>()
    const mappings = fileAsset._components.map((component) => component.reference)
    for (const targetUniversalKey of collectReferencedTargetsInAsset(fileAsset)) {
        const targetRef =
            mappings.find((mapping) => mapping.universalKey === targetUniversalKey) ??
            referenceForTarget(targetUniversalKey)
        const referrers = fileAsset.referencedBy(targetRef)
        const entries = referrers
            .map((referrerRef) => entryForReferrer(fileAsset, targetRef, referrerRef))
            .filter((entry): entry is PersistedReferencedByEntry => Boolean(entry))
        patches.set(targetUniversalKey, entries)
    }
    return patches
}
