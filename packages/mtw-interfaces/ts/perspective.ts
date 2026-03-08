/**
 * Portable data-shapes for authoring "perspective" (which assets we are using, in order)
 * and "perspective matcher" (required/forbidden assets for compatibility).
 *
 * Perspective: exact ordered list of assets (base-first, leaf last). Order is significant
 * for cache keying (perspectiveId) and ExampleUpdated assetStack.
 *
 * PerspectiveMatcher: class of configurations that match - requiredAssetIds must all
 * appear in the perspective; forbiddenAssetIds must not appear; other assets are "don't care."
 */

import { AssetUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'

export type Perspective = {
    assetStack: AssetUUID[]
}

export type PerspectiveMatcher = {
    requiredAssetIds: AssetUUID[]
    forbiddenAssetIds?: AssetUUID[]
}

/**
 * Returns true iff the perspective's assetStack contains every required asset
 * and none of the forbidden assets. Undefined forbiddenAssetIds is treated as [].
 */
export const perspectiveMatches = (
    matcher: PerspectiveMatcher,
    perspective: Perspective
): boolean => {
    const stack = perspective.assetStack
    const forbidden = matcher.forbiddenAssetIds ?? []
    for (const id of matcher.requiredAssetIds) {
        if (!stack.includes(id)) return false
    }
    for (const id of forbidden) {
        if (stack.includes(id)) return false
    }
    return true
}

export const isPerspective = (value: unknown): value is Perspective => {
    if (!value || typeof value !== 'object') return false
    const obj = value as Record<string, unknown>
    if (!Array.isArray(obj.assetStack)) return false
    return obj.assetStack.every((item: unknown) => typeof item === 'string' && isSchemaAssetUUID(item))
}

export const isPerspectiveMatcher = (value: unknown): value is PerspectiveMatcher => {
    if (!value || typeof value !== 'object') return false
    const obj = value as Record<string, unknown>
    if (!Array.isArray(obj.requiredAssetIds)) return false
    if (!obj.requiredAssetIds.every((item: unknown) => typeof item === 'string' && isSchemaAssetUUID(item))) {
        return false
    }
    if (obj.forbiddenAssetIds !== undefined) {
        if (!Array.isArray(obj.forbiddenAssetIds)) return false
        if (!obj.forbiddenAssetIds.every((item: unknown) => typeof item === 'string' && isSchemaAssetUUID(item))) {
            return false
        }
    }
    return true
}
