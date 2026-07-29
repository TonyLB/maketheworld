import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import { prepareObjectRenderForCharacter, type PrepareObjectRenderDeps } from './prepareObjectRenderForCharacter'

jest.mock('../perception/kickRoomHeaderBroadcast', () => ({
    __esModule: true,
    resolveCharacterRoomPerspectiveForRoom: jest.fn(async (roomId: string, characterAssets: readonly string[]) => {
        if (characterAssets.length === 0) {
            return null
        }
        const assetStack = [...characterAssets] as any
        return {
            perspective: { assetStack },
            perspectiveKey: computePerspectiveKey(assetStack),
        }
    }),
}))

const baseDeps = (overrides: Partial<PrepareObjectRenderDeps> = {}): PrepareObjectRenderDeps => ({
    getMembershipContainers: async () => ['ROOM#Cafe'],
    getCharacterAssets: async () => ['ASSET#Canon'],
    ...overrides,
})

describe('prepareObjectRenderForCharacter', () => {
    it('resolves perspective from the acting character current room, not object asset linkage', async () => {
        const prepared = await prepareObjectRenderForCharacter(
            'CHARACTER#Test',
            'OBJECT#Tray',
            baseDeps(),
        )

        expect(prepared.perspective.assetStack).toEqual(['ASSET#Canon'])
        expect(prepared.perspectiveKey).toEqual(computePerspectiveKey(['ASSET#Canon']))
        expect(prepared.renderCommand).toEqual({
            componentId: 'OBJECT#Tray',
            perspective: prepared.perspective,
            characterId: 'CHARACTER#Test',
            allowGeneration: false,
        })
    })

    it('throws when the acting character has no resolvable current room', async () => {
        await expect(
            prepareObjectRenderForCharacter(
                'CHARACTER#Test',
                'OBJECT#Tray',
                baseDeps({ getMembershipContainers: async () => [] }),
            )
        ).rejects.toThrow(/could not resolve a current room/)
    })

    it('throws when perspective cannot be resolved for the room', async () => {
        await expect(
            prepareObjectRenderForCharacter(
                'CHARACTER#Test',
                'OBJECT#Tray',
                baseDeps({ getCharacterAssets: async () => [] }),
            )
        ).rejects.toThrow(/could not resolve a perspective/)
    })
})
