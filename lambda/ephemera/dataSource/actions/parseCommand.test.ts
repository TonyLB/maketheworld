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
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
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
                orders: [{
                    valid: true,
                    name: 'rocket-powered roller skates',
                    description: '',
                    affinities: [],
                }],
                confidence: 0.9,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [
                    { valid: true, name: 'anvil', description: '', affinities: [] },
                    {
                        valid: false,
                        name: 'justice',
                        errorType: 'Not tangible',
                        description: '',
                        affinities: [],
                    },
                ],
                confidence: 0.85,
            })).toBe(true)
        })

        it('rejects invalid confidence, empty orders, or blank lines', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'skates', description: '', affinities: [] }],
                confidence: -0.01,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: '  ', description: '', affinities: [] }],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'anvil',
                    errorType: 'Not a thing',
                    description: '',
                    affinities: [],
                } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'anvil', description: '', affinities: [] }],
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
                orders: [{
                    valid: false,
                    name: 'moon',
                    errorType: 'Too large',
                    description: '',
                    affinities: [],
                }],
                confidence: 0.5,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rope',
                    description: 'still here',
                    affinities: [],
                    affinitiesFailed: true,
                }],
                confidence: 0.9,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rope',
                    description: '',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                    affinitiesFailed: true,
                }],
                confidence: 0.9,
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
        expect(prompt).toContain('later step')
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
            orders: [{ valid: true, name: 'rocket skates', description: '', affinities: [] }],
            confidence: 0.9,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["  anvil  ","magnet"],"confidence":0.7}'
        )).toEqual({
            type: 'AcmeOrder',
            orders: [
                { valid: true, name: 'anvil', description: '', affinities: [] },
                { valid: true, name: 'magnet', description: '', affinities: [] },
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
            orders: [{ valid: true, name: 'giant rubber band', description: '', affinities: [] }],
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
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"CoyoteEngineTest","confidence":0.9}'
        )).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder, Unimplemented, or Unknown payload (see prompt)',
        })
    })
})

describe('isCoyoteEngineTestSlashCommand', () => {
    it('matches exact and suffix-with-whitespace forms', () => {
        expect(isCoyoteEngineTestSlashCommand('/test generation')).toBe(true)
        expect(isCoyoteEngineTestSlashCommand('  /test generation  ')).toBe(true)
        expect(isCoyoteEngineTestSlashCommand('/test generation extra')).toBe(true)
        expect(isCoyoteEngineTestSlashCommand('/test generation  --x')).toBe(true)
    })

    it('does not match typos or missing word boundary after generation', () => {
        expect(isCoyoteEngineTestSlashCommand('/test generations')).toBe(false)
        expect(isCoyoteEngineTestSlashCommand('/test generationfoo')).toBe(false)
        expect(isCoyoteEngineTestSlashCommand('/test')).toBe(false)
        expect(isCoyoteEngineTestSlashCommand('order anvil')).toBe(false)
    })
})

describe('parseCommand LLM path', () => {
    it('returns CoyoteEngineTest without Bedrock for /test generation', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            { command: '/test generation' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({ type: 'CoyoteEngineTest', confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('returns CoyoteEngineTest for slash command with trailing args without Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()

        const result = await parseCommand(
            { command: '  /test generation verbose  ' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'CoyoteEngineTest', confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
    })

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

    it('returns AcmeOrder merged with enrich when both Bedrock calls succeed', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","orders":["dynamite","spring"],"confidence":0.82}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [
                    {
                        name: 'dynamite sticks',
                        description: 'Bundle of cartoon dynamite.',
                        affinities: [{ role: 'terminal', aptness: 0.5 }],
                    },
                    {
                        name: 'spring',
                        description: 'Steel coil.',
                        affinities: [{ role: 'trigger', aptness: 0.4 }],
                    },
                ],
                confidence: 0.9,
            }),
        })

        const result = await parseCommand(
            { command: 'mail order dynamite and a spring from acme' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [
                {
                    valid: true,
                    name: 'dynamite sticks',
                    description: 'Bundle of cartoon dynamite.',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
                {
                    valid: true,
                    name: 'spring',
                    description: 'Steel coil.',
                    affinities: [{ role: 'trigger', aptness: 0.4 }],
                },
            ],
            confidence: 0.82 * 0.9,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
    })

    it('merges per-line: one good enrich line and one unparseable line still returns AcmeOrder with combined confidence', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","orders":["dynamite","spring"],"confidence":0.82}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [
                    {
                        name: 'dynamite sticks',
                        description: 'Bundle of cartoon dynamite.',
                        affinities: [{ role: 'terminal', aptness: 0.5 }],
                    },
                    { bad: true },
                ],
                confidence: 0.9,
            }),
        })

        const result = await parseCommand(
            { command: 'mail order dynamite and a spring from acme' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [
                {
                    valid: true,
                    name: 'dynamite sticks',
                    description: 'Bundle of cartoon dynamite.',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
                {
                    valid: true,
                    name: 'spring',
                    description: '',
                    affinities: [],
                    affinitiesFailed: true,
                },
            ],
            confidence: 0.82 * 0.9,
        })
    })

    it('marks affinitiesFailed and keeps Step A confidence when enrich Bedrock fails', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","orders":[{"valid":true,"name":"anvil"}],"confidence":0.75}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: false,
            errorMessage: 'timeout',
        })

        const result = await parseCommand(
            { command: 'order anvil from acme' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: true,
                name: 'anvil',
                description: '',
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: 0.75,
        })
    })

    it('skips enrich when every Acme line is invalid', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","orders":[{"valid":false,"name":"Justice","errorType":"Not tangible"}],"confidence":0.8}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            { command: 'order justice from acme' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [{
                valid: false,
                name: 'Justice',
                errorType: 'Not tangible',
                description: '',
                affinities: [],
            }],
            confidence: 0.8,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })
})
