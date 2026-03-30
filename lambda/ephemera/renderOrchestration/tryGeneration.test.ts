import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'
import type { GenerateRoomPreviewResult } from '../conversations/conversationTypes/generateRoomPreview'
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

    const generatedCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: roomId,
        DataCategory: 'CACHE#generated',
        markState,
        renderedContent: { description: [] },
        provenance: { type: 'generated' },
        perspectiveId: 'P#generated',
        perspectiveMatcher: {
            requiredAssetIds: ['ASSET#base'],
            forbiddenAssetIds: [],
        },
    }

    it('returns skip and does not call generateRoomPreview when allowGeneration is false', async () => {
        const generateRoomPreview = jest.fn()
        const sendMessage = jest.fn()
        const out = await tryGeneration({ ...baseResolve, allowGeneration: false }, { generateRoomPreview, sendMessage })
        expect(out).toBe('skip')
        expect(generateRoomPreview).not.toHaveBeenCalled()
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('defaults allowGeneration to true when undefined', async () => {
        const result: GenerateRoomPreviewResult = {
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        }
        const generateRoomPreview = jest.fn().mockResolvedValue(result)
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const out = await tryGeneration({ ...baseResolve, allowGeneration: undefined }, { generateRoomPreview, sendMessage })
        expect(out).toBe('fail')
        expect(generateRoomPreview).toHaveBeenCalledTimes(1)
    })

    it('forwards generating progress through sendMessage', async () => {
        const result: GenerateRoomPreviewResult = {
            success: true,
            renderedContent: { description: [] },
            cacheId: 'CACHE#generated',
            cacheRecord: generatedCacheRecord,
        }
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.onGenerating?.()
            return result
        })
        await tryGeneration(baseResolve, { generateRoomPreview, sendMessage })
        expect(sendMessage.mock.calls[0][0]).toBe('generating')
    })

    it('returns success and emits resolved output', async () => {
        const result: GenerateRoomPreviewResult = {
            success: true,
            renderedContent: { description: [] },
            cacheId: 'CACHE#generated',
            cacheRecord: generatedCacheRecord,
        }
        const generateRoomPreview = jest.fn().mockResolvedValue(result)
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const out = await tryGeneration(baseResolve, { generateRoomPreview, conversationId: '550e8400-e29b-41d4-a716-446655440000', sendMessage })
        expect(out).toBe('success')
        expect(sendMessage).toHaveBeenLastCalledWith({
            type: 'resolved',
            renderedContent: result.renderedContent,
            cacheId: result.cacheId,
            cacheRecord: result.cacheRecord,
        })
    })

    it('returns fail and emits failed output', async () => {
        const result: GenerateRoomPreviewResult = {
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        }
        const generateRoomPreview = jest.fn().mockResolvedValue(result)
        const sendMessage = jest.fn().mockResolvedValue(undefined)
        const out = await tryGeneration(baseResolve, { generateRoomPreview, sendMessage })
        expect(out).toBe('fail')
        expect(sendMessage).toHaveBeenLastCalledWith({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
    })
})
