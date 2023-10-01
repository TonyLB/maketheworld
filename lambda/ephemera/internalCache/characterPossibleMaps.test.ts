jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

describe('CharacterPossibleMaps', () => {
    let graphGetMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.CharacterPossibleMaps._Graph, "get").mockImplementation(graphGetMock)
    })

    it('should report all maps containing the room the character is in', async () => {
        graphGetMock.mockReturnValue(new Graph<string, { key: string }, { context: string }>({
                'ROOM#testOne': { key: 'ROOM#testOne' },
                'MAP#testTwo': { key: 'MAP#testTwo' },
                'MAP#testThree': { key: 'MAP#testThree' }
            },
            [
                { from: 'ROOM#testOne', to: 'MAP#testTwo', context: 'TestAsset' },
                { from: 'ROOM#testOne', to: 'MAP#testThree', context: 'TestAsset' }
            ],
            true
        ))
        const output = await internalCache.CharacterPossibleMaps.get('CHARACTER#testCharacter')
        expect(graphGetMock).toHaveBeenCalledTimes(1)
        expect(output).toEqual({ EphemeraId: 'CHARACTER#testCharacter', mapsPossible: ['MAP#testTwo', 'MAP#testThree'] })
    })

})