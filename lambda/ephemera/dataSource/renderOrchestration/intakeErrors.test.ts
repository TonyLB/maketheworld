import { getIntakeOrchestrationErrorIfAny } from './intakeErrors'

describe('dataSource/renderOrchestration/getIntakeOrchestrationErrorIfAny', () => {
    it('returns null on success intake', () => {
        const err = getIntakeOrchestrationErrorIfAny({
            type: 'success',
            roomId: 'ROOM#one',
            perspective: { assetStack: [] },
            markState: { markValue: [] },
            markProvenance: 'meta',
        })
        expect(err).toBeNull()
    })

    it('maps RENDER_REQUESTED_NOT_ROOM to NOT_ROOM', () => {
        const err = getIntakeOrchestrationErrorIfAny({
            type: 'error',
            errorCode: 'RENDER_REQUESTED_NOT_ROOM',
            errorMessage: 'not a room',
        })
        expect(err).toEqual({
            errorCode: 'NOT_ROOM',
            errorMessage: 'not a room',
        })
    })

    it('maps META_ROOM_MARKS_MISSING', () => {
        const err = getIntakeOrchestrationErrorIfAny({
            type: 'error',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: 'marks',
        })
        expect(err).toEqual({
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: 'marks',
        })
    })
})
