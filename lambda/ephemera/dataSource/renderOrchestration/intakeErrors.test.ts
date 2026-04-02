import { deliverIntakeErrorsIfAny } from './intakeErrors'

describe('dataSource/renderOrchestration/deliverIntakeErrorsIfAny', () => {
    it('returns false and does not call sendMessage on success intake', async () => {
        const sendMessage = jest.fn()
        const handled = await deliverIntakeErrorsIfAny(
            {
                type: 'success',
                roomId: 'ROOM#one',
                perspective: { assetStack: [] },
                markState: { markValue: [] },
                markProvenance: 'meta',
            },
            sendMessage
        )
        expect(handled).toBe(false)
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('maps RENDER_REQUESTED_NOT_ROOM to NOT_ROOM failed terminal', async () => {
        const sendMessage = jest.fn()
        const handled = await deliverIntakeErrorsIfAny(
            {
                type: 'error',
                errorCode: 'RENDER_REQUESTED_NOT_ROOM',
                errorMessage: 'not a room',
            },
            sendMessage
        )
        expect(handled).toBe(true)
        expect(sendMessage).toHaveBeenCalledWith({
            type: 'failed',
            errorCode: 'NOT_ROOM',
            errorMessage: 'not a room',
        })
    })

    it('maps META_ROOM_MARKS_MISSING to failed terminal', async () => {
        const sendMessage = jest.fn()
        const handled = await deliverIntakeErrorsIfAny(
            {
                type: 'error',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: 'marks',
            },
            sendMessage
        )
        expect(handled).toBe(true)
        expect(sendMessage).toHaveBeenCalledWith({
            type: 'failed',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: 'marks',
        })
    })
})
