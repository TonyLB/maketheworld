import messageBus from '../../../../messageBus'
import * as applyModule from './applyObjectDrop'
import { executeObjectDrop } from './executeObjectDrop'

jest.mock('./applyObjectDrop', () => ({
    applyObjectDrop: jest.fn(),
}))

const applyObjectDropMock = applyModule.applyObjectDrop as jest.MockedFunction<
    typeof applyModule.applyObjectDrop
>

describe('executeObjectDrop', () => {
    it('delegates to applyObjectDrop with ingress args', async () => {
        applyObjectDropMock.mockResolvedValue({
            ok: true,
            froms: ['CHARACTER#alpha'],
            to: 'ROOM#TownSquare',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })

        const streamEvent = jest.fn(async () => {})

        await executeObjectDrop({
            characterId: 'CHARACTER#alpha',
            objectId: 'OBJECT#Broom',
            roomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })

        expect(applyObjectDropMock).toHaveBeenCalledWith(
            {
                objectId: 'OBJECT#Broom',
                roomId: 'ROOM#TownSquare',
                characterId: 'CHARACTER#alpha',
            },
            {
                messageBus,
                streamEvent,
            }
        )
    })
})
