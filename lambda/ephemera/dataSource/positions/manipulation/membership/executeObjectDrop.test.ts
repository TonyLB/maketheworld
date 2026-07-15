import messageBus from '../../../../messageBus'
import * as applyModule from './applyObjectSetDrop'
import { executeObjectDrop } from './executeObjectDrop'

jest.mock('./applyObjectSetDrop', () => ({
    applyObjectSetDrop: jest.fn(),
}))

const applyObjectSetDropMock = applyModule.applyObjectSetDrop as jest.MockedFunction<
    typeof applyModule.applyObjectSetDrop
>

describe('executeObjectDrop', () => {
    it('delegates to applyObjectSetDrop with ingress args', async () => {
        applyObjectSetDropMock.mockResolvedValue({
            ok: true,
            diffs: [{ objectId: 'OBJECT#Broom', froms: ['CHARACTER#alpha'], to: 'ROOM#TownSquare', changed: true }],
            beatAnchorTime: 1_700_000_000_000,
        })

        const streamEvent = jest.fn(async () => {})

        await executeObjectDrop({
            characterId: 'CHARACTER#alpha',
            objectIds: ['OBJECT#Broom'],
            roomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })

        expect(applyObjectSetDropMock).toHaveBeenCalledWith(
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
