import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../internalCache'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import type { RenderRequestedCommand } from './localApiEvents'

export type PreparedObjectRender = {
    componentId: EphemeraObjectId;
    characterId: EphemeraCharacterId;
    perspective: Perspective;
    perspectiveKey: string;
    renderCommand: RenderRequestedCommand;
}

export type PrepareObjectRenderDeps = {
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<string[]>;
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>;
}

const defaultDeps = (): PrepareObjectRenderDeps => ({
    getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
})

/**
 * Resolve Object perspective and commands for correlated description thread + passive render ---
 * the Object-stub sibling of `prepareFeatureKnowledgeRenderForCharacter.ts`. Object has no import-
 * vertical participation of its own (unlike Feature/Knowledge), so perspective is resolved the same
 * way `roomObjectCatalogForCharacter.ts` already does: from the acting character's *current room*,
 * not the object's own asset linkage.
 */
export async function prepareObjectRenderForCharacter(
    characterId: EphemeraCharacterId,
    componentId: EphemeraObjectId,
    deps: PrepareObjectRenderDeps = defaultDeps(),
): Promise<PreparedObjectRender> {
    const containers = await deps.getMembershipContainers(characterId)
    const roomId = containers[0]
    if (!roomId || !isEphemeraRoomId(roomId)) {
        throw new Error(`prepareObjectRenderForCharacter: could not resolve a current room for ${characterId}`)
    }

    const characterAssets = await deps.getCharacterAssets(characterId)
    const resolved = await resolveCharacterRoomPerspectiveForRoom(roomId, characterAssets)
    if (resolved === null) {
        throw new Error(`prepareObjectRenderForCharacter: could not resolve a perspective for ${characterId} in ${roomId}`)
    }
    const { perspective, perspectiveKey } = resolved

    const renderCommand: RenderRequestedCommand = {
        componentId,
        perspective,
        characterId,
        allowGeneration: false,
    }
    return {
        componentId,
        characterId,
        perspective,
        perspectiveKey,
        renderCommand,
    }
}
