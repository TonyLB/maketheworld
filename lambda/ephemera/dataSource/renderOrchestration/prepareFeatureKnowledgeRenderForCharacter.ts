import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { mergeParticipationOrderFromImportVerticalHops } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { ImportVerticalHop } from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { unique } from '@tonylb/mtw-utilities/ts/lists'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import type { PerceptionThreadRegisterCommand } from '../perception/localApiEvents'
import type { RenderRequestedCommand } from './localApiEvents'

export type FeatureKnowledgeComponentId = EphemeraFeatureId | EphemeraKnowledgeId

export type PreparedFeatureKnowledgeRender = {
    componentId: FeatureKnowledgeComponentId;
    characterId: EphemeraCharacterId;
    perspective: Perspective;
    perspectiveKey: string;
    threadRegisterCommand: PerceptionThreadRegisterCommand;
    renderCommand: RenderRequestedCommand;
}

export type PrepareFeatureKnowledgeRenderDeps = {
    getGlobalAssets: () => Promise<string[] | undefined>;
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<AssetUUID[]>;
    getImportVerticalHops: (componentId: FeatureKnowledgeComponentId) => Promise<ImportVerticalHop[]>;
}

const defaultDeps = (): PrepareFeatureKnowledgeRenderDeps => ({
    getGlobalAssets: () => internalCache.Global.get('assets'),
    getCharacterAssets: async (characterId) => {
        const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
        return characterAssets.map((key) => AssetKey(key) as AssetUUID)
    },
    getImportVerticalHops: async (componentId) => {
        const [entry] = await internalCache.ComponentVerticals.get([componentId])
        return entry?.hops ?? []
    },
})

export async function loadCharacterVisibleAssetIds(
    characterId: EphemeraCharacterId,
    deps: Pick<PrepareFeatureKnowledgeRenderDeps, 'getGlobalAssets' | 'getCharacterAssets'>,
): Promise<AssetUUID[]> {
    const [globalAssets, characterAssets] = await Promise.all([
        deps.getGlobalAssets(),
        deps.getCharacterAssets(characterId),
    ])
    return unique(globalAssets || [], characterAssets).map((key) => AssetKey(key) as AssetUUID)
}

export function intersectParticipationOrderWithCharacterVisibility(
    participationOrder: readonly AssetUUID[],
    characterVisibleAssets: readonly AssetUUID[],
): AssetUUID[] {
    const visible = new Set(characterVisibleAssets.map((assetId) => AssetKey(assetId) as AssetUUID))
    return participationOrder.filter((assetId) => visible.has(AssetKey(assetId) as AssetUUID))
}

/**
 * Resolve Feature/Knowledge perspective and commands for correlated description thread + passive render.
 * Perspective = character-visible assets intersected with component vertical participation order.
 */
export async function prepareFeatureKnowledgeRenderForCharacter(
    characterId: EphemeraCharacterId,
    componentId: FeatureKnowledgeComponentId,
    deps: PrepareFeatureKnowledgeRenderDeps = defaultDeps(),
): Promise<PreparedFeatureKnowledgeRender> {
    const [characterVisibleAssets, hops] = await Promise.all([
        loadCharacterVisibleAssetIds(characterId, deps),
        deps.getImportVerticalHops(componentId),
    ])
    const participationOrder = mergeParticipationOrderFromImportVerticalHops(hops)
    const assetStack = intersectParticipationOrderWithCharacterVisibility(
        participationOrder,
        characterVisibleAssets,
    )
    const perspective = { assetStack }
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const threadRegisterCommand: PerceptionThreadRegisterCommand = isEphemeraKnowledgeId(componentId)
        ? {
            threadKind: 'knowledgeDescription',
            componentId,
            perspectiveKey,
            characterId,
        }
        : {
            threadKind: 'featureDescription',
            componentId,
            perspectiveKey,
            characterId,
        }
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
        threadRegisterCommand,
        renderCommand,
    }
}
