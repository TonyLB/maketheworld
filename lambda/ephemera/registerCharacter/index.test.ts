jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import {
    connectionDB
} from '@tonylb/mtw-utilities/ts/dynamoDB/index'

jest.mock('../messageBus')
import messageBus from '../messageBus'

jest.mock('../internalCache')

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>

import registerCharacter from '.'

describe('registerCharacter (Phase 4 cutover: no-op shell)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('does not write any session/character adjacency rows', async () => {
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }],
            messageBus,
        })

        expect(connectionDBMock.transactWrite).not.toHaveBeenCalled()
    })

    it('does not enqueue CheckLocation, EphemeraUpdate, or ReturnValue messages', async () => {
        await registerCharacter({
            payloads: [{ type: 'RegisterCharacter', characterId: 'CHARACTER#ABC' }],
            messageBus,
        })

        expect(messageBusMock.send).not.toHaveBeenCalled()
    })

    it('handles an empty payloads array without side effects', async () => {
        await registerCharacter({ payloads: [], messageBus })

        expect(connectionDBMock.transactWrite).not.toHaveBeenCalled()
        expect(messageBusMock.send).not.toHaveBeenCalled()
    })
})
