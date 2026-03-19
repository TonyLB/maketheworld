import {
    isRenderRequested,
    isRenderGenerationStarted,
    isRenderReady,
    isRenderGenerationCompleted,
    isRenderGenerationFailed,
    isRenderOrchestrationMessage
} from './events'

describe('renderOrchestration events guards', () => {
    const base = {
        componentId: 'ROOM#room' as const,
        perspective: { assetStack: ['ASSET#a', 'ASSET#b'] as const }
    }

    it('accepts valid RenderRequested', () => {
        expect(isRenderRequested({
            type: 'RenderRequested',
            ...base,
            characterId: 'CHARACTER#char',
            targets: ['CHARACTER#char'],
            allowGeneration: true,
            generationContextWml: '<Asset />'
        })).toBe(true)
    })

    it('rejects RenderRequested with invalid perspective', () => {
        expect(isRenderRequested({
            type: 'RenderRequested',
            ...base,
            perspective: { assetStack: ['ROOM#bad'] }
        })).toBe(false)
    })

    it('accepts RenderGenerationStarted with optional targets omitted', () => {
        expect(isRenderGenerationStarted({
            type: 'RenderGenerationStarted',
            ...base
        })).toBe(true)
    })

    it('accepts valid RenderReady with cacheId and optional cacheRecord', () => {
        expect(isRenderReady({
            type: 'RenderReady',
            ...base,
            cacheId: 'CACHE#abc',
            cacheRecord: { DataCategory: 'CACHE#abc' }
        })).toBe(true)
    })

    it('rejects RenderReady with non-cache cacheId', () => {
        expect(isRenderReady({
            type: 'RenderReady',
            ...base,
            cacheId: 'NOTCACHE#abc'
        })).toBe(false)
    })

    it('accepts valid RenderGenerationCompleted', () => {
        expect(isRenderGenerationCompleted({
            type: 'RenderGenerationCompleted',
            ...base,
            cacheId: 'CACHE#done'
        })).toBe(true)
    })

    it('accepts valid RenderGenerationFailed', () => {
        expect(isRenderGenerationFailed({
            type: 'RenderGenerationFailed',
            ...base,
            errorCode: 'GENERATION_FAILED',
            errorMessage: 'Unable to generate'
        })).toBe(true)
    })

    it('rejects RenderGenerationFailed with missing errorMessage', () => {
        expect(isRenderGenerationFailed({
            type: 'RenderGenerationFailed',
            ...base,
            errorCode: 'GENERATION_FAILED'
        })).toBe(false)
    })

    it('umbrella guard accepts all supported events and rejects unknown', () => {
        expect(isRenderOrchestrationMessage({
            type: 'RenderRequested',
            ...base
        })).toBe(true)
        expect(isRenderOrchestrationMessage({
            type: 'RenderGenerationStarted',
            ...base
        })).toBe(true)
        expect(isRenderOrchestrationMessage({
            type: 'RenderReady',
            ...base,
            cacheId: 'CACHE#ok'
        })).toBe(true)
        expect(isRenderOrchestrationMessage({
            type: 'RenderGenerationCompleted',
            ...base,
            cacheId: 'CACHE#ok'
        })).toBe(true)
        expect(isRenderOrchestrationMessage({
            type: 'RenderGenerationFailed',
            ...base,
            errorCode: 'X',
            errorMessage: 'Y'
        })).toBe(true)
        expect(isRenderOrchestrationMessage({
            type: 'NotRenderMessage',
            ...base
        })).toBe(false)
    })
})

