import { runParseStage } from './runParseStage'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

describe('runParseStage', () => {
    it('returns tokens on successful Bedrock invoke and parse', async () => {
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"tokens":[{"type":"text","text":"put"},{"type":"objectSpan","span":"bag"},{"type":"text","text":"in"},{"type":"objectSpan","span":"box"}]}',
        })

        const result = await runParseStage(
            { command: 'put the bag in the box' },
            { invokeBedrockObjectManipulationParseImpl }
        )

        expect(result).toEqual({
            type: 'success',
            tokens: [
                { type: 'text', text: 'put' },
                { type: 'objectSpan', span: 'bag' },
                { type: 'text', text: 'in' },
                { type: 'objectSpan', span: 'box' },
            ],
        })
        expect(invokeBedrockObjectManipulationParseImpl).toHaveBeenCalled()
    })

    it('returns a single text token for a zero-referent command', async () => {
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"tokens":[{"type":"text","text":"look"}]}',
        })

        const result = await runParseStage(
            { command: 'look' },
            { invokeBedrockObjectManipulationParseImpl }
        )

        expect(result).toEqual({
            type: 'success',
            tokens: [{ type: 'text', text: 'look' }],
        })
    })

    it('returns invoke failure error', async () => {
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({
            success: false,
        })

        const result = await runParseStage(
            { command: 'put the bag in the box' },
            { invokeBedrockObjectManipulationParseImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.parseInvokeFailed,
        })
    })

    it('returns parse failure error', async () => {
        const invokeBedrockObjectManipulationParseImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })

        const result = await runParseStage(
            { command: 'put the bag in the box' },
            { invokeBedrockObjectManipulationParseImpl }
        )

        expect(result.type).toBe('error')
        if (result.type === 'error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.parseParseFailed)
        }
    })
})
