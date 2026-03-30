import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheMarkState } from '../renderCache/baseClasses'
import type { RenderResolveInput } from './baseClasses'
import { tryGeneration } from './tryGeneration'

describe('tryGeneration', () => {
    const roomId = 'ROOM#one' as EphemeraRoomId
    const markState: EphemeraCacheMarkState = { markValue: [{ mark: 'MARK#a', value: 'one' }] }
    const baseResolve: RenderResolveInput = {
        roomId,
        perspective: { assetStack: ['ASSET#base'] },
        markState,
        markProvenance: 'meta',
        generationContextWml: '<Asset key=(Test) />',
    }

    it('delegates to generateRoomPreview even when resolve.allowGeneration is false (findRender gates policy)', async () => {
        const generateRoomPreview = jest.fn().mockResolvedValue('fail')
        const sendMessage = jest.fn()
        const out = await tryGeneration({ ...baseResolve, allowGeneration: false }, { generateRoomPreview, sendMessage })
        expect(out).toBe('fail')
        expect(generateRoomPreview).toHaveBeenCalledTimes(1)
    })

    it('calls generateRoomPreview when allowGeneration is undefined', async () => {
        const generateRoomPreview = jest.fn().mockResolvedValue('fail')
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const out = await tryGeneration({ ...baseResolve, allowGeneration: undefined }, { generateRoomPreview, sendMessage })
        expect(out).toBe('fail')
        expect(generateRoomPreview).toHaveBeenCalledTimes(1)
    })

    it('forwards generating progress through sendMessage inside generateRoomPreview', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.sendMessage?.('generating')
            return 'success'
        })
        await tryGeneration(baseResolve, { generateRoomPreview, sendMessage })
        expect(sendMessage.mock.calls[0][0]).toBe('generating')
    })

    it('returns success when generateRoomPreview returns success', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const generateRoomPreview = jest.fn().mockResolvedValue('success')
        const out = await tryGeneration(baseResolve, { generateRoomPreview, conversationId: '550e8400-e29b-41d4-a716-446655440000', sendMessage })
        expect(out).toBe('success')
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('returns fail when generateRoomPreview returns fail', async () => {
        const generateRoomPreview = jest.fn().mockResolvedValue('fail')
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const out = await tryGeneration(baseResolve, { generateRoomPreview, sendMessage })
        expect(out).toBe('fail')
        expect(sendMessage).not.toHaveBeenCalled()
    })
})
