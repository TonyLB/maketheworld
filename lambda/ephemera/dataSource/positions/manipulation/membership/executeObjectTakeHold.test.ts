import messageBus from '../../../../messageBus'
import { executeObjectTakeHold } from './executeObjectTakeHold'

describe('executeObjectTakeHold', () => {
    it('resolves without side effects (Phase 3 stub)', async () => {
        const streamEvent = jest.fn(async () => {})
        const publishSpy = jest.spyOn(messageBus, 'publish')

        await expect(executeObjectTakeHold({
            characterId: 'CHARACTER#alpha',
            objectId: 'OBJECT#Broom',
            roomId: 'ROOM#TownSquare',
            messageBus,
            streamEvent,
        })).resolves.toBeUndefined()

        expect(streamEvent).not.toHaveBeenCalled()
        expect(publishSpy).not.toHaveBeenCalled()

        publishSpy.mockRestore()
    })
})
