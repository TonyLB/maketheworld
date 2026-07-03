import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'
import { resolveCharacterRoomPerspectiveForRoom } from './kickRoomHeaderBroadcast'

export type TakeHoldPresentationLabels = {
    characterName: string
    objectShortName: string
}

export type ResolveTakeHoldPresentationLabelsDeps = {
    getCharacterMeta: (characterId: EphemeraCharacterId) => Promise<{ Name?: string } | undefined>
    resolvePerspective: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ assetStack: readonly string[] } | null>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    getComponentAggregate: ComponentAggregateMergedCache['get']
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): ResolveTakeHoldPresentationLabelsDeps => ({
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
    deps: Pick<ResolveTakeHoldPresentationLabelsDeps, 'getComponentAggregate'>
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
 * Resolve display labels for object manipulation transcript copy at fan-in emit
 * (take-hold and drop; D11 / D4). Does not require the object to remain in the room
 * position graph after apply.
 */
export async function resolveTakeHoldPresentationLabels(
    args: {
        characterId: EphemeraCharacterId
        objectId: EphemeraObjectId
        roomId: EphemeraRoomId
    },
    partialDeps: Partial<ResolveTakeHoldPresentationLabelsDeps> = {}
): Promise<TakeHoldPresentationLabels> {
    const deps: ResolveTakeHoldPresentationLabelsDeps = { ...defaultDeps(), ...partialDeps }
    const characterMeta = await deps.getCharacterMeta(args.characterId)
    const characterName = characterMeta?.Name || 'Someone'

    const characterAssets = await deps.getCharacterAssets(args.characterId)
    const resolvedPerspective = await deps.resolvePerspective(args.roomId, characterAssets)
    let objectShortName: string | undefined
    if (resolvedPerspective !== null) {
        objectShortName = await shortNameFromMergedAggregate(args.objectId, resolvedPerspective.assetStack, deps)
    }
    if (!objectShortName) {
        const pairRow = await deps.getImprovisationObject(args.objectId)
        objectShortName = shortNameFromComponent(pairRow?.component)
    }

    return {
        characterName,
        objectShortName: objectShortName || 'something',
    }
}
