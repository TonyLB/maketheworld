import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { generateRoomDescription } from './generateRoomDescription'

jest.mock('./invokeBedrockRoomDescription', () => ({
    invokeBedrockRoomDescription: jest.fn()
}))

const minimalWml = '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test Room</ShortName></Room></Asset>'

describe('generateRoomDescription', () => {
    const { invokeBedrockRoomDescription } = jest.requireMock('./invokeBedrockRoomDescription') as {
        invokeBedrockRoomDescription: jest.Mock
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns NO_EXACT_MATCH when generationContext is null', async () => {
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: null
        })
        expect(result).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })
        expect(invokeBedrockRoomDescription).not.toHaveBeenCalled()
    })

    it('returns success with wrapped renderedContent when Bedrock returns valid JSON', async () => {
        invokeBedrockRoomDescription.mockResolvedValue({
            success: true,
            body: JSON.stringify({
                displayName: 'Dim Corridor',
                summary: 'A dimly lit hallway.',
                description: 'The corridor is barely lit by a single sconce.'
            })
        })

        const form = new StandardForm(minimalWml)
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: form
        })

        expect(invokeBedrockRoomDescription).toHaveBeenCalledTimes(1)
        expect(result).toEqual({
            success: true,
            renderedContent: {
                displayName: ['Dim Corridor'],
                summary: ['A dimly lit hallway.'],
                description: ['The corridor is barely lit by a single sconce.']
            }
        })
    })

    it('returns success when Bedrock returns JSON wrapped in markdown code fence', async () => {
        invokeBedrockRoomDescription.mockResolvedValue({
            success: true,
            body: '```json\n{"displayName":"Hall","summary":"A hall.","description":"A quiet hall."}\n```'
        })

        const form = new StandardForm(minimalWml)
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: form
        })

        expect(result).toEqual({
            success: true,
            renderedContent: {
                displayName: ['Hall'],
                summary: ['A hall.'],
                description: ['A quiet hall.']
            }
        })
    })

    it('returns GENERATION_FAILED when Bedrock returns failure', async () => {
        invokeBedrockRoomDescription.mockResolvedValue({
            success: false,
            errorMessage: 'Bedrock request timed out after 30000ms'
        })

        const form = new StandardForm(minimalWml)
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: form
        })

        expect(result).toEqual({
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: 'Bedrock request timed out after 30000ms'
        })
    })

    it('returns GENERATION_FAILED when response is not valid JSON', async () => {
        invokeBedrockRoomDescription.mockResolvedValue({
            success: true,
            body: 'not json at all'
        })

        const form = new StandardForm(minimalWml)
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: form
        })

        expect(result).toEqual({
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: 'Model response was not valid JSON with required fields'
        })
    })

    it('returns GENERATION_FAILED when description is missing', async () => {
        invokeBedrockRoomDescription.mockResolvedValue({
            success: true,
            body: JSON.stringify({ displayName: 'X', summary: 'Y' })
        })

        const form = new StandardForm(minimalWml)
        const result = await generateRoomDescription({
            roomId: 'ROOM#test' as any,
            markState: { markValue: [] },
            perspective: { assetStack: [] },
            generationContext: form
        })

        expect(result.success).toBe(false)
        expect((result as any).errorCode).toBe('GENERATION_FAILED')
    })
})
