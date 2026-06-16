import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { ImportVerticalHop } from '@tonylb/mtw-gateways/ts/assets/components/verticals'

import internalCache from '../../internalCache'
import {
    intersectParticipationOrderWithCharacterVisibility,
    prepareFeatureKnowledgeRenderForCharacter,
    type PrepareFeatureKnowledgeRenderDeps,
} from './prepareFeatureKnowledgeRenderForCharacter'

const hop = (
    parentAssetId: string,
    childAssetId: string,
): ImportVerticalHop => ({
    universalKey: 'FEATURE#Feat',
    dataCategory: `Meta::Import::${parentAssetId.replace('ASSET#', '')}::${childAssetId.replace('ASSET#', '')}`,
    parentStripped: parentAssetId.replace('ASSET#', ''),
    childStripped: childAssetId.replace('ASSET#', ''),
    parentAssetId: parentAssetId as ImportVerticalHop['parentAssetId'],
    childAssetId: childAssetId as ImportVerticalHop['childAssetId'],
})

const baseDeps = (
    overrides: Partial<PrepareFeatureKnowledgeRenderDeps> = {},
): PrepareFeatureKnowledgeRenderDeps => ({
    getGlobalAssets: async () => ['ASSET#Canon'],
    getCharacterAssets: async () => ['ASSET#Owned'],
    getImportVerticalHops: async () => [
        hop('ASSET#Canon', 'ASSET#Layer'),
        hop('ASSET#Layer', 'ASSET#Overlay'),
    ],
    ...overrides,
})

describe('intersectParticipationOrderWithCharacterVisibility', () => {
    it('preserves vertical order while filtering to visible assets', () => {
        expect(
            intersectParticipationOrderWithCharacterVisibility(
                ['ASSET#Canon', 'ASSET#Layer', 'ASSET#Overlay'],
                ['ASSET#Layer', 'ASSET#Other'],
            )
        ).toEqual(['ASSET#Layer'])
    })
})

describe('prepareFeatureKnowledgeRenderForCharacter', () => {
    it('computes intersected perspective and perspectiveKey for Feature hosts', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'FEATURE#Feat',
            baseDeps({
                getGlobalAssets: async () => ['ASSET#Canon'],
                getCharacterAssets: async () => ['ASSET#Overlay'],
            }),
        )

        expect(prepared.perspective.assetStack).toEqual(['ASSET#Canon', 'ASSET#Overlay'])
        expect(prepared.perspectiveKey).toEqual(
            computePerspectiveKey(['ASSET#Canon', 'ASSET#Overlay']),
        )
        expect(prepared.threadRegisterCommand).toEqual({
            threadKind: 'featureDescription',
            componentId: 'FEATURE#Feat',
            perspectiveKey: prepared.perspectiveKey,
            characterId: 'CHARACTER#Test',
        })
        expect(prepared.renderCommand).toEqual({
            componentId: 'FEATURE#Feat',
            perspective: prepared.perspective,
            characterId: 'CHARACTER#Test',
            allowGeneration: false,
        })
    })

    it('uses knowledgeDescription thread kind for Knowledge hosts', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'KNOWLEDGE#Know',
            baseDeps({
                getImportVerticalHops: async () => [hop('ASSET#Canon', 'ASSET#Layer')],
                getCharacterAssets: async () => [],
            }),
        )

        expect(prepared.threadRegisterCommand).toMatchObject({
            threadKind: 'knowledgeDescription',
            componentId: 'KNOWLEDGE#Know',
        })
        expect(prepared.perspective.assetStack).toEqual(['ASSET#Canon'])
    })

    it('includes directResponse on knowledgeDescription registration when requested', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'KNOWLEDGE#Know',
            baseDeps(),
            { directResponse: true },
        )

        expect(prepared.threadRegisterCommand).toEqual({
            threadKind: 'knowledgeDescription',
            componentId: 'KNOWLEDGE#Know',
            perspectiveKey: prepared.perspectiveKey,
            characterId: 'CHARACTER#Test',
            directResponse: true,
        })
    })

    it('excludes character-owned assets not in the vertical', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'FEATURE#Feat',
            baseDeps({
                getGlobalAssets: async () => [],
                getCharacterAssets: async () => ['ASSET#Unrelated', 'ASSET#Overlay'],
                getImportVerticalHops: async () => [hop('ASSET#Canon', 'ASSET#Overlay')],
            }),
        )

        expect(prepared.perspective.assetStack).toEqual(['ASSET#Overlay'])
    })

    it('excludes vertical assets the character cannot see', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'FEATURE#Feat',
            baseDeps({
                getGlobalAssets: async () => ['ASSET#Canon'],
                getCharacterAssets: async () => [],
                getImportVerticalHops: async () => [
                    hop('ASSET#Canon', 'ASSET#HiddenLayer'),
                ],
            }),
        )

        expect(prepared.perspective.assetStack).toEqual(['ASSET#Canon'])
    })

    it('returns empty assetStack when vertical hops are empty', async () => {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'FEATURE#Feat',
            baseDeps({
                getImportVerticalHops: async () => [],
            }),
        )

        expect(prepared.perspective.assetStack).toEqual([])
        expect(prepared.perspectiveKey).toEqual(computePerspectiveKey([]))
    })

    it('does not populate generationContextWml or call ComponentRender.get', async () => {
        const componentRenderGetSpy = jest.spyOn(internalCache.ComponentRender, 'get')
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(
            'CHARACTER#Test',
            'FEATURE#Feat',
            baseDeps(),
        )

        expect(prepared.renderCommand.generationContextWml).toBeUndefined()
        expect(componentRenderGetSpy).not.toHaveBeenCalled()
        componentRenderGetSpy.mockRestore()
    })
})
