import internalCache from '../../../internalCache'
import { prepareFullRoomDescriptionRenderForCharacter } from './requestFullRoomDescriptionForCharacter'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from '../../renderOrchestration/fanOutStateChangedToPassiveRenders'

jest.mock('../../state/resolveAssetStackForRoom', () => ({
    resolveCanonAssetStackForRoom: jest.fn(),
    resolveRoomAssetStackForRoom: jest.fn(),
}))

jest.mock('../../renderOrchestration/fanOutStateChangedToPassiveRenders', () => ({
    filterRoomCanonStackByCharacterAssets: jest.fn(),
}))

const mockResolveCanonAssetStackForRoom = resolveCanonAssetStackForRoom as jest.MockedFunction<
    typeof resolveCanonAssetStackForRoom
>
const mockResolveRoomAssetStackForRoom = resolveRoomAssetStackForRoom as jest.MockedFunction<
    typeof resolveRoomAssetStackForRoom
>
const mockFilterRoomCanonStackByCharacterAssets = filterRoomCanonStackByCharacterAssets as jest.MockedFunction<
    typeof filterRoomCanonStackByCharacterAssets
>

describe('prepareFullRoomDescriptionRenderForCharacter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRoomAssetStackForRoom.mockResolvedValue(['ASSET#Base'])
        mockResolveCanonAssetStackForRoom.mockResolvedValue(['ASSET#Base'])
        mockFilterRoomCanonStackByCharacterAssets.mockReturnValue(['ASSET#Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Test Character',
            RoomId: 'ROOM#Test',
            RoomStack: [],
            HomeId: 'ROOM#Test',
            assets: ['ASSET#Base'],
        })
    })

    it('does not populate generationContextWml on default path', async () => {
        const componentRenderGetSpy = jest.spyOn(internalCache.ComponentRender, 'get')
        const prepared = await prepareFullRoomDescriptionRenderForCharacter('CHARACTER#Test', 'ROOM#Test')

        expect(prepared.renderCommand.generationContextWml).toBeUndefined()
        expect(componentRenderGetSpy).not.toHaveBeenCalled()

        componentRenderGetSpy.mockRestore()
    })

    it('does not populate generationContextWml on repeated invocation', async () => {
        const componentRenderGetSpy = jest.spyOn(internalCache.ComponentRender, 'get')
        const prepared = await prepareFullRoomDescriptionRenderForCharacter('CHARACTER#Test', 'ROOM#Test')

        expect(prepared.renderCommand.generationContextWml).toBeUndefined()
        expect(componentRenderGetSpy).not.toHaveBeenCalled()

        componentRenderGetSpy.mockRestore()
    })
})
