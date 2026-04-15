import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandErrorResult,
    isParseCommandNavigationResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'
import { parseCommand } from './parseCommand'

describe('parseCommand type guards', () => {
    const room = 'ROOM#x' as EphemeraRoomId

    describe('isParseCommandNavigationResult', () => {
        it('accepts valid Navigation with confidence in [0, 1]', () => {
            expect(isParseCommandNavigationResult({
                type: 'Navigation',
                targetId: room,
                confidence: 0.85,
            })).toBe(true)
        })

        it('rejects missing or out-of-range confidence', () => {
            expect(isParseCommandNavigationResult({
                type: 'Navigation',
                targetId: room,
            } as any)).toBe(false)
            expect(isParseCommandNavigationResult({
                type: 'Navigation',
                targetId: room,
                confidence: 1.1,
            })).toBe(false)
        })
    })

    describe('isParseCommandAcmeOrderResult', () => {
        it('accepts valid AcmeOrder with confidence', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                order: 'skates',
                confidence: 0.9,
            })).toBe(true)
        })

        it('rejects invalid confidence', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                order: 'skates',
                confidence: -0.01,
            })).toBe(false)
        })
    })

    it('isParseCommandAwaitRoadrunnerResult requires confidence', () => {
        expect(isParseCommandAwaitRoadrunnerResult({ type: 'AwaitRoadRunner', confidence: 0.7 })).toBe(true)
        expect(isParseCommandAwaitRoadrunnerResult({ type: 'AwaitRoadRunner' } as any)).toBe(false)
    })

    it('isParseCommandUnimplementedResult and isParseCommandUnknownResult require confidence', () => {
        expect(isParseCommandUnimplementedResult({ type: 'Unimplemented', confidence: 0.5 })).toBe(true)
        expect(isParseCommandUnimplementedResult({ type: 'Unimplemented' } as any)).toBe(false)
        expect(isParseCommandUnknownResult({ type: 'Unknown', confidence: 0.2 })).toBe(true)
        expect(isParseCommandUnknownResult({ type: 'Unknown' } as any)).toBe(false)
    })

    it('isParseCommandErrorResult does not require confidence', () => {
        expect(isParseCommandErrorResult({ type: 'Error' })).toBe(true)
        expect(isParseCommandErrorResult({ type: 'Error', errorMessage: 'x' })).toBe(true)
    })
})

describe('buildParseCommandIntentClassificationPrompt', () => {
    it('embeds the trimmed command and classification vocabulary', () => {
        const prompt = buildParseCommandIntentClassificationPrompt('  attack troll  ')
        expect(prompt).toContain('attack troll')
        expect(prompt).toContain('Unimplemented')
        expect(prompt).toContain('Unknown')
        expect(prompt).toContain('"type": "Unimplemented"')
        expect(prompt).toContain('"type": "Unknown"')
    })

    it('uses placeholder for empty or whitespace-only command', () => {
        expect(buildParseCommandIntentClassificationPrompt('')).toContain('(empty command)')
        expect(buildParseCommandIntentClassificationPrompt('   ')).toContain('(empty command)')
    })
})

describe('interpretParseCommandIntentClassificationBody', () => {
    it('accepts bare JSON for Unimplemented and Unknown', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unimplemented","confidence":0.8}'
        )).toEqual({ type: 'Unimplemented', confidence: 0.8 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unknown","confidence":0.25}'
        )).toEqual({ type: 'Unknown', confidence: 0.25 })
    })

    it('strips markdown fences and tolerates surrounding prose', () => {
        expect(interpretParseCommandIntentClassificationBody(
            'Here is JSON:\n```json\n{"type":"Unknown","confidence":1}\n```'
        )).toEqual({ type: 'Unknown', confidence: 1 })
    })

    it('rejects invalid JSON, wrong type, or bad confidence', () => {
        expect(interpretParseCommandIntentClassificationBody('not json').type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Navigation","targetId":"ROOM#x","confidence":0.9}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unimplemented"}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unknown","confidence":2}'
        ).type).toBe('Error')
    })
})

describe('parseCommand LLM path', () => {
    it('returns interpreted body when Bedrock succeeds', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"Unimplemented","confidence":0.7}',
        })

        const result = await parseCommand(
            { command: 'use teleporter' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'Unimplemented', confidence: 0.7 })
        expect(invokeBedrockParseCommandImpl).toHaveBeenCalledTimes(1)
        const promptArg = invokeBedrockParseCommandImpl.mock.calls[0][0] as string
        expect(promptArg).toContain('use teleporter')
    })

    it('returns Error when Bedrock fails', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'ThrottlingException',
        })

        const result = await parseCommand({ command: 'x' }, { invokeBedrockParseCommandImpl })

        expect(result).toEqual({ type: 'Error', errorMessage: 'ThrottlingException' })
    })
})
