import { intakeRenderRequested } from './requestIntake'
import type { RenderRequested } from './events'

describe('dataSource/renderOrchestration/intakeRenderRequested', () => {
    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] }
    }

    const baseMetaRoom = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'Meta::Room' as const,
        state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } },
        currentCacheByPerspective: { 'PERSPECTIVE#v1#abc': 'CACHE#valid' as const },
    }

    it('returns not_room for non-room componentId', async () => {
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#x' }
        const r = await intakeRenderRequested(payload)
        expect(r).toEqual({
            type: 'error',
            errorCode: 'RENDER_REQUESTED_NOT_ROOM',
            errorMessage: expect.stringContaining('componentId must be a room id'),
        })
    })

    it('returns marks_missing when Meta has no marks', async () => {
        const r = await intakeRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
        })
        expect(r).toEqual({
            type: 'error',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('Meta::Room.state.marks'),
        })
    })

    it('returns ok with RenderResolveInput including pointerHint when Meta has pointer', async () => {
        const r = await intakeRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
        })
        expect(r.type).toBe('success')
        if (r.type === 'success') {
            expect(r.roomId).toBe('ROOM#one')
            expect(r.markProvenance).toBe('meta')
            expect(r.pointerHint).toBe('CACHE#valid')
        }
    })

})
