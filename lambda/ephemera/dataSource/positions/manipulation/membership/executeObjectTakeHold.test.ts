import messageBus from '../../../../messageBus'
import * as applyModule from './applyObjectSetTakeHold'
import { executeObjectTakeHold } from './executeObjectTakeHold'

jest.mock('./applyObjectSetTakeHold', () => ({
    applyObjectSetTakeHold: jest.fn(),
}))

const applyObjectSetTakeHoldMock = applyModule.applyObjectSetTakeHold as jest.MockedFunction<
    typeof applyModule.applyObjectSetTakeHold
>

describe('executeObjectTakeHold', () => {
    it('delegates to applyObjectSetTakeHold with ingress args', async () => {
        applyObjectSetTakeHoldMock.mockResolvedValue({
            ok: true,
            diffs: [{ objectId: 'OBJECT#Broom', froms: ['ROOM#Cafe'], to: 'CHARACTER#alpha', changed: true }],
            beatAnchorTime: 1_700_000_000_000,
        })

        const streamEvent = jest.fn(async () => {})

        await executeObjectTakeHold({
            characterId: 'CHARACTER#alpha',
            objectIds: ['OBJECT#Broom'],
            roomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })

        expect(applyObjectSetTakeHoldMock).toHaveBeenCalledWith(
            {
                objectIds: ['OBJECT#Broom'],
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
