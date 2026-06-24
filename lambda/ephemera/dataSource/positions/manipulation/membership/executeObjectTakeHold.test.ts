import messageBus from '../../../../messageBus'
import * as applyModule from './applyObjectTakeHold'
import { executeObjectTakeHold } from './executeObjectTakeHold'

jest.mock('./applyObjectTakeHold', () => ({
    applyObjectTakeHold: jest.fn(),
}))

const applyObjectTakeHoldMock = applyModule.applyObjectTakeHold as jest.MockedFunction<
    typeof applyModule.applyObjectTakeHold
>

describe('executeObjectTakeHold', () => {
    it('delegates to applyObjectTakeHold with ingress args', async () => {
        applyObjectTakeHoldMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#Cafe'],
            to: 'CHARACTER#alpha',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })

        const streamEvent = jest.fn(async () => {})

        await executeObjectTakeHold({
            characterId: 'CHARACTER#alpha',
            objectId: 'OBJECT#Broom',
            roomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })

        expect(applyObjectTakeHoldMock).toHaveBeenCalledWith(
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
