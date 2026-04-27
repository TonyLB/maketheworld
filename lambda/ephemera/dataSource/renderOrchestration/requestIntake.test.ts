import { intakeRenderRequested } from './requestIntake'
import type { RenderRequested } from '../../messageBus/baseClasses'

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

    it('uses empty markState and disables generation when Meta has no marks and room has no lens defaults', async () => {
        const r = await intakeRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
            computeDefaultMarksForRoom: jest.fn().mockResolvedValue({ markValue: [] }),
        })
        expect(r.type).toBe('success')
        if (r.type === 'success') {
            expect(r.markState).toEqual({ markValue: [] })
            expect(r.allowGeneration).toBe(false)
            expect(r.pointerHint).toBe('CACHE#valid')
        }
    })

    it('uses computed defaults when Meta has no marks but room has lens defaults', async () => {
        const computed = { markValue: [{ mark: 'MARK#x', value: 'y' }] }
        const r = await intakeRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
            computeDefaultMarksForRoom: jest.fn().mockResolvedValue(computed),
        })
        expect(r.type).toBe('success')
        if (r.type === 'success') {
            expect(r.markState).toEqual(computed)
            expect(r.allowGeneration).toBeUndefined()
        }
    })

    it('returns marks_missing when default marks computation throws', async () => {
        const r = await intakeRenderRequested(basePayload, {
            getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
            computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
            computeDefaultMarksForRoom: jest.fn().mockRejectedValue(new Error('cache miss')),
        })
        expect(r).toEqual({
            type: 'error',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('could not resolve default marks'),
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
