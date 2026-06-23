import { extractObjectIdsFromPlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'
import { normalizeExitName } from './roomExitTargetsForCharacter'

export type RoomObjectLabelsDeps = {
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<string[]>
    getPositionGraph: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): RoomObjectLabelsDeps => ({
    getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
    getPositionGraph: (roomId) => internalCache.Positions.getPositionGraph(roomId),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

const shortNameFromComponent = (component: StandardComponent | undefined): string | undefined => {
    if (!(component instanceof StandardObject) || !component.shortName) {
        return undefined
    }
    const shortName = shortNameToJSON(component.shortName)
    return typeof shortName === 'string' ? shortName : undefined
}

/**
 * Thin compose-stack projection: normalized improvisation shortNames for objects
 * in the character's current room (classify prompt context only).
 */
export async function getRoomObjectLabelsForCharacter(
    characterId: EphemeraCharacterId,
    deps: RoomObjectLabelsDeps = defaultDeps()
): Promise<string[]> {
    const containers = await deps.getMembershipContainers(characterId)
    const roomId = containers[0]
    if (!roomId || !isEphemeraRoomId(roomId)) {
        return []
    }

    const positionGraph = await deps.getPositionGraph(roomId)
    const objectIds = extractObjectIdsFromPlayPositionGraph(positionGraph)
    if (objectIds.length === 0) {
        return []
    }

    const labels = await Promise.all(objectIds.map(async (objectId) => {
        const pairRow = await deps.getImprovisationObject(objectId)
        const shortName = shortNameFromComponent(pairRow?.component)
        if (!shortName) {
            return undefined
        }
        const normalized = normalizeExitName(shortName)
        return normalized.length > 0 ? normalized : undefined
    }))

    return [...new Set(labels.filter((label): label is string => label !== undefined))]
}
