import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import type { RenderRequestedCommand } from './localApiEvents'
import { loadCharacterVisibleAssetIds, type PrepareFeatureKnowledgeRenderDeps } from './prepareFeatureKnowledgeRenderForCharacter'

export type PreparedCharacterRender = {
    componentId: EphemeraCharacterId;
    characterId: EphemeraCharacterId;
    perspective: Perspective;
    perspectiveKey: string;
    renderCommand: RenderRequestedCommand;
}

export type PrepareCharacterRenderDeps = Pick<PrepareFeatureKnowledgeRenderDeps, 'getGlobalAssets' | 'getCharacterAssets'>

const defaultDeps = (): PrepareCharacterRenderDeps => ({
    getGlobalAssets: () => internalCache.Global.get('assets'),
    getCharacterAssets: async (characterId) => {
        const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
        return characterAssets.map((key) => AssetKey(key) as AssetUUID)
    },
})

/**
 * Resolve Character perspective and the render command for a character-directed look (RH-1,
 * resolved): the asset stack is a property of the *viewing* actor, not of any room or of the
 * target character's own linkage --- a character-directed look resolves against the acting
 * character's own visible-asset stack, the same stack that governs everything else that character
 * perceives. There is no target-room-vs-actor-room framing to port from
 * `prepareObjectRenderForCharacter.ts`; this reuses `loadCharacterVisibleAssetIds` directly.
 */
export async function prepareCharacterRenderForCharacter(
    actingCharacterId: EphemeraCharacterId,
    targetCharacterId: EphemeraCharacterId,
    deps: PrepareCharacterRenderDeps = defaultDeps(),
): Promise<PreparedCharacterRender> {
    const assetStack = await loadCharacterVisibleAssetIds(actingCharacterId, deps)
    const perspective = { assetStack }
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const renderCommand: RenderRequestedCommand = {
        componentId: targetCharacterId,
        perspective,
        characterId: actingCharacterId,
        allowGeneration: false,
    }
    return {
        componentId: targetCharacterId,
        characterId: actingCharacterId,
        perspective,
        perspectiveKey,
        renderCommand,
    }
}
