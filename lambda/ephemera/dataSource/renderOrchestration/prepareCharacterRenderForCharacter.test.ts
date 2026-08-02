import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import { prepareCharacterRenderForCharacter, type PrepareCharacterRenderDeps } from './prepareCharacterRenderForCharacter'

const baseDeps = (
    overrides: Partial<PrepareCharacterRenderDeps> = {},
): PrepareCharacterRenderDeps => ({
    getGlobalAssets: async () => ['ASSET#Canon'],
    getCharacterAssets: async () => ['ASSET#Owned'],
    ...overrides,
})

describe('prepareCharacterRenderForCharacter', () => {
    it('resolves perspective from the viewing (acting) character, not the target', async () => {
        const prepared = await prepareCharacterRenderForCharacter(
            'CHARACTER#Viewer',
            'CHARACTER#Target',
            baseDeps({
                getGlobalAssets: async () => ['ASSET#Canon'],
                getCharacterAssets: async () => ['ASSET#Owned'],
            }),
        )

        expect(prepared.perspective.assetStack).toEqual(['ASSET#Canon', 'ASSET#Owned'])
        expect(prepared.perspectiveKey).toEqual(
            computePerspectiveKey(['ASSET#Canon', 'ASSET#Owned']),
        )
        expect(prepared.componentId).toBe('CHARACTER#Target')
        expect(prepared.characterId).toBe('CHARACTER#Viewer')
        expect(prepared.renderCommand).toEqual({
            componentId: 'CHARACTER#Target',
            perspective: prepared.perspective,
            characterId: 'CHARACTER#Viewer',
            allowGeneration: false,
        })
    })

    it('ignores any assets that would be specific to the target character', async () => {
        const getCharacterAssets = jest.fn(async (characterId: string): Promise<`ASSET#${string}`[]> =>
            characterId === 'CHARACTER#Viewer' ? ['ASSET#ViewerOnly'] : ['ASSET#TargetOnly']
        )
        const prepared = await prepareCharacterRenderForCharacter(
            'CHARACTER#Viewer',
            'CHARACTER#Target',
            baseDeps({ getGlobalAssets: async () => [], getCharacterAssets }),
        )

        expect(getCharacterAssets).toHaveBeenCalledWith('CHARACTER#Viewer')
        expect(getCharacterAssets).not.toHaveBeenCalledWith('CHARACTER#Target')
        expect(prepared.perspective.assetStack).toEqual(['ASSET#ViewerOnly'])
    })

    it('does not populate generationContextWml', async () => {
        const prepared = await prepareCharacterRenderForCharacter(
            'CHARACTER#Viewer',
            'CHARACTER#Target',
            baseDeps(),
        )

        expect(prepared.renderCommand.generationContextWml).toBeUndefined()
    })
})
