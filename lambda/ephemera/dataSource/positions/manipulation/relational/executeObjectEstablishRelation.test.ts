import { executeObjectEstablishRelation } from './executeObjectEstablishRelation'
import * as coordinator from './applyObjectRelationalChange'

jest.mock('./applyObjectRelationalChange', () => ({
    applyObjectRelationalChange: jest.fn(),
}))

const applyObjectRelationalChangeMock = coordinator.applyObjectRelationalChange as jest.MockedFunction<
    typeof coordinator.applyObjectRelationalChange
>

describe('executeObjectEstablishRelation', () => {
    it('delegates to applyObjectRelationalChange with establish operation', async () => {
        const messageBus = { publish: jest.fn() }
        const streamEvent = jest.fn()

        await executeObjectEstablishRelation({
            characterId: 'CHARACTER#Alpha',
            subjectId: 'OBJECT#Broom',
            targetId: 'OBJECT#Table',
            hostId: 'ROOM#Cafe',
            relationKind: 'On',
            messageBus: messageBus as any,
            streamEvent: streamEvent as any,
        })

        expect(applyObjectRelationalChangeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subjectId: 'OBJECT#Broom',
                targetId: 'OBJECT#Table',
                hostId: 'ROOM#Cafe',
                relationKind: 'On',
                operation: 'establish',
            }),
            expect.objectContaining({
                messageBus,
                streamEvent,
            })
        )
    })
})
