import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
    isEphemeraCharacterId,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'
import { resolveCharacterRoomPerspectiveForRoom } from './kickRoomHeaderBroadcast'

export type NarrationLabels = {
    characterName: string
    /**
     * Display label per requested id: an object's short name (falling back to `'something'`), a
     * character's name (falling back to `'Someone'`) --- a relation's far end can be a character.
     */
    names: Record<string, string>
}

export type ResolveNarrationLabelsDeps = {
    getCharacterMeta: (characterId: EphemeraCharacterId) => Promise<{ Name?: string } | undefined>
    resolvePerspective: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ assetStack: readonly string[] } | null>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    getComponentAggregate: ComponentAggregateMergedCache['get']
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): ResolveNarrationLabelsDeps => ({
    getCharacterMeta: (characterId) => internalCache.CharacterMeta.get(characterId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
    resolvePerspective: async (roomId, characterAssets) => {
        const resolved = await resolveCharacterRoomPerspectiveForRoom(roomId, characterAssets)
        if (resolved === null) {
            return null
        }
        return { assetStack: resolved.perspective.assetStack }
    },
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

const shortNameFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!(component instanceof StandardObject) || !component.shortName) {
        return undefined
    }
    const shortName = shortNameToJSON(component.shortName)
    return typeof shortName === 'string' ? shortName : undefined
}

const shortNameFromMergedAggregate = async (
    objectId: EphemeraObjectId,
    assetStack: readonly string[],
    deps: Pick<ResolveNarrationLabelsDeps, 'getComponentAggregate'>
): Promise<string | undefined> => {
    const mergeParticipationOrder = appendImprovisationToPerspective([...assetStack] as AssetUUID[], [objectId])
    const perspective = aggregatePerspectiveExplicit({
        universalKey: objectId,
        mergeParticipationOrder,
    })
    const aggregateResults = await deps.getComponentAggregate([perspective])
    return shortNameFromComponent(aggregateResults[0]?.merged)
}

/**
 * Resolve display labels for an attempt's narration --- the actor's name and a name per object
 * or character a narration unit refers to --- once per attempt, for `commitAttempt` to hand
 * `deliverNarrationUnits`. Does not require an object to remain in the room position graph after
 * apply, which is what lets it serve a take (object gone from the room) and a drop alike.
 *
 * Every object is named against the acting character's room perspective (`roomId`); with no room
 * (`undefined`), no perspective resolves and each name comes from the improvisation pair row alone.
 * It stays here in `perception/` on the same precedent as `publishMembershipPresentation.ts`'s
 * surviving suffix builders, which `presentStepSequence` likewise imports across the data-source
 * boundary.
 */
export async function resolveNarrationLabels(
    args: {
        characterId: EphemeraCharacterId
        ids: readonly (EphemeraObjectId | EphemeraCharacterId)[]
        roomId: EphemeraRoomId | undefined
    },
    partialDeps: Partial<ResolveNarrationLabelsDeps> = {}
): Promise<NarrationLabels> {
    const deps: ResolveNarrationLabelsDeps = { ...defaultDeps(), ...partialDeps }
    const characterMeta = await deps.getCharacterMeta(args.characterId)
    const characterName = characterMeta?.Name || 'Someone'
    const ids = [...new Set(args.ids)]
    const characterEntries = await Promise.all(ids.filter(isEphemeraCharacterId).map(async (id) => (
        [id, (await deps.getCharacterMeta(id))?.Name || 'Someone'] as const
    )))
    const objectIds = ids.filter(isEphemeraObjectId)
    if (objectIds.length === 0) {
        return { characterName, names: Object.fromEntries(characterEntries) }
    }

    const characterAssets = await deps.getCharacterAssets(args.characterId)
    const resolvedPerspective = args.roomId === undefined ? null : await deps.resolvePerspective(args.roomId, characterAssets)
    // `resolvedPerspective === null` means no perspective resolved, so the merged aggregate can't
    // be attempted and the improvisation pair row is the only source. When a perspective IS
    // resolved, its participation order already includes `ASSET#IMPROVISATION` --- routed through
    // the same ephemeraDB pair-row table --- so a separate improvisation read afterward would only
    // ever repeat a lookup the aggregate already made.
    const objectEntries = await Promise.all(objectIds.map(async (objectId) => {
        const shortName = resolvedPerspective !== null
            ? await shortNameFromMergedAggregate(objectId, resolvedPerspective.assetStack, deps)
            : shortNameFromComponent((await deps.getImprovisationObject(objectId))?.component)
        return [objectId, shortName || 'something'] as const
    }))

    return {
        characterName,
        names: Object.fromEntries([...characterEntries, ...objectEntries]),
    }
}
