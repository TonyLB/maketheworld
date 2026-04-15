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
        it('accepts valid AcmeOrder with orders and confidence', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'rocket-powered roller skates' }],
                confidence: 0.9,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [
                    { valid: true, name: 'anvil' },
                    { valid: false, name: 'justice', errorType: 'Not tangible' },
                ],
                confidence: 0.85,
            })).toBe(true)
        })

        it('rejects invalid confidence, empty orders, or blank lines', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'skates' }],
                confidence: -0.01,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: '  ' }],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'anvil', errorType: 'Not a thing' } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'anvil' } as any],
                confidence: 0.5,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: false, errorType: 'Too large' } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                order: 'legacy only',
                confidence: 0.9,
            } as any)).toBe(false)
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
        expect(prompt).toContain('AwaitRoadRunner')
        expect(prompt).toContain('AcmeOrder')
        expect(prompt).toContain('Unimplemented')
        expect(prompt).toContain('Unknown')
        expect(prompt).toContain('"type": "AwaitRoadRunner"')
        expect(prompt).toContain('"type": "AcmeOrder"')
        expect(prompt).toContain('"type": "Unimplemented"')
        expect(prompt).toContain('"type": "Unknown"')
    })

    it('uses placeholder for empty or whitespace-only command', () => {
        expect(buildParseCommandIntentClassificationPrompt('')).toContain('(empty command)')
        expect(buildParseCommandIntentClassificationPrompt('   ')).toContain('(empty command)')
    })
})

describe('interpretParseCommandIntentClassificationBody', () => {
    it('accepts bare JSON for AwaitRoadRunner, AcmeOrder, Unimplemented, and Unknown', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AwaitRoadRunner","confidence":0.95}'
        )).toEqual({ type: 'AwaitRoadRunner', confidence: 0.95 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["rocket skates"],"confidence":0.9}'
        )).toEqual({
            type: 'AcmeOrder',
            orders: [{ valid: true, name: 'rocket skates' }],
            confidence: 0.9,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["  anvil  ","magnet"],"confidence":0.7}'
        )).toEqual({
            type: 'AcmeOrder',
            orders: [
                { valid: true, name: 'anvil' },
                { valid: true, name: 'magnet' },
            ],
            confidence: 0.7,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unimplemented","confidence":0.8}'
        )).toEqual({ type: 'Unimplemented', confidence: 0.8 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unknown","confidence":0.25}'
        )).toEqual({ type: 'Unknown', confidence: 0.25 })
    })

    it('accepts AcmeOrder with legacy single order string when orders array is absent', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","order":"  giant rubber band  ","confidence":0.6}'
        )).toEqual({
            type: 'AcmeOrder',
            orders: [{ valid: true, name: 'giant rubber band' }],
            confidence: 0.6,
        })
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
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AwaitRoadRunner"}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","confidence":0.9}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":[],"confidence":0.9}'
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

    it('returns AwaitRoadRunner when the model emits it', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AwaitRoadRunner","confidence":0.88}',
        })

        const result = await parseCommand(
            { command: 'wait for the bird' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'AwaitRoadRunner', confidence: 0.88 })
    })

    it('returns AcmeOrder when the model emits orders', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","orders":["dynamite","spring"],"confidence":0.82}',
        })

        const result = await parseCommand(
            { command: 'mail order dynamite and a spring from acme' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [
                { valid: true, name: 'dynamite' },
                { valid: true, name: 'spring' },
            ],
            confidence: 0.82,
        })
    })
})
