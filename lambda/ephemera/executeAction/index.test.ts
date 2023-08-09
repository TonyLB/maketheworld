jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('../dependentMessages/dependencyCascade')
import dependencyCascade from '../dependentMessages/dependencyCascade'

import executeActionMessage from '.'
import { CharacterMetaItem } from '../internalCache/characterMeta'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const dependencyCascadeMock = dependencyCascade as jest.Mocked<typeof dependencyCascade>
const internalCacheMock = jest.mocked(internalCache, true)
const exponentialBackoffMock = exponentialBackoffWrapper as jest.Mock

describe('ExecuteActionMessage', () => {
    const testCharacterMeta: CharacterMetaItem = {
        Name: 'Tess',
        Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' },
        Color: 'purple',
        EphemeraId: 'CHARACTER#Somebody',
        RoomId: 'ROOM#VORTEX',
        HomeId: 'ROOM#VORTEX',
        assets: []
    }
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        exponentialBackoffMock.mockImplementation(async (func) => { await func() })
    })

    it('should execute an action and cascade', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            src: 'a = a + b',
            rootAsset: 'base'
        })
        ephemeraDBMock.query.mockResolvedValue([])
        internalCacheMock.AssetMap.get.mockResolvedValue({
            a: 'VARIABLE#VariableOne',
            b: 'VARIABLE#VariableTwo'
        })
        internalCacheMock.AssetState.get.mockResolvedValue({
            a: 1,
            b: 2
        })
        internalCacheMock.CharacterMeta.get.mockResolvedValue(testCharacterMeta)
        await executeActionMessage({
            payloads: [
                { type: 'ExecuteAction', actionId: 'ACTION#TestOne', characterId: 'CHARACTER#Somebody' },
                { type: 'ExecuteAction', actionId: 'ACTION#TestTwo', characterId: 'CHARACTER#SomebodyElse' },
            ],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.transactWrite.mock.calls[0][0]).toMatchSnapshot()
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send.mock.calls[0][0]).toMatchSnapshot()
        expect(dependencyCascadeMock).toHaveBeenCalledTimes(1)
        expect(dependencyCascadeMock).toHaveBeenCalledWith({
            payloads: [
                { targetId: 'VARIABLE#VariableOne', value: 3 }
            ],
            messageBus: messageBusMock
        })

    })

})