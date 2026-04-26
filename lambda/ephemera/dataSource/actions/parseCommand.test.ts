import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandErrorResult,
    isParseCommandLookRoomResult,
    isParseCommandNavigationIntentResult,
    isParseCommandNavigationResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'
import {
    navigationIntentErrorMessages,
    parseCommand,
    parseCommandWithEnrichReasoning,
} from './parseCommand'

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

    describe('isParseCommandNavigationIntentResult', () => {
        it('accepts valid NavigationIntent shape for Step A', () => {
            expect(isParseCommandNavigationIntentResult({
                type: 'NavigationIntent',
                exitCandidate: 'north',
                confidence: 0.75,
            })).toBe(true)
        })

        it('rejects blank exitCandidate or invalid confidence', () => {
            expect(isParseCommandNavigationIntentResult({
                type: 'NavigationIntent',
                exitCandidate: '   ',
                confidence: 0.75,
            })).toBe(false)
            expect(isParseCommandNavigationIntentResult({
                type: 'NavigationIntent',
                exitCandidate: 'north',
                confidence: 2,
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
                    stableKey: 'rocket-powered-roller-skates',
                    affinities: [],
                }],
                confidence: 0.9,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [
                    { valid: true, name: 'anvil', stableKey: 'anvil', affinities: [] },
                    {
                        valid: false,
                        name: 'justice',
                        errorType: 'Not tangible',
                        affinities: [],
                    },
                ],
                confidence: 0.85,
            })).toBe(true)
        })

        it('rejects valid true line that also carries errorType (mixed shape)', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'anvil',
                    errorType: 'Not a thing',
                    affinities: [],
                } as any],
                confidence: 0.5,
            })).toBe(false)
        })

        it('rejects invalid confidence, empty orders, or blank lines', () => {
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'skates', stableKey: 'skates', affinities: [] }],
                confidence: -0.01,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: '', stableKey: 'x', affinities: [] }],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true, name: 'anvil', stableKey: 'anvil', affinities: [] }],
                confidence: 0.5,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: true } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{ valid: false, name: 'x', affinities: [] } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: false,
                    name: 'moon',
                    errorType: 'Too large',
                    affinities: [],
                }],
                confidence: 0.5,
            })).toBe(true)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: false,
                    name: 'moon',
                    stableKey: 'moon',
                    errorType: 'Too large',
                    affinities: [],
                } as any],
                confidence: 0.5,
            })).toBe(false)
            expect(isParseCommandAcmeOrderResult({
                type: 'AcmeOrder',
                orders: [{
                    valid: true,
                    name: 'rope',
                    stableKey: 'rope',
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

    it('isParseCommandLookRoomResult requires confidence in [0, 1]', () => {
        expect(isParseCommandLookRoomResult({ type: 'LookRoom', confidence: 1 })).toBe(true)
        expect(isParseCommandLookRoomResult({ type: 'LookRoom', confidence: 0.4 })).toBe(true)
        expect(isParseCommandLookRoomResult({ type: 'LookRoom' } as any)).toBe(false)
        expect(isParseCommandLookRoomResult({ type: 'LookRoom', confidence: 1.5 })).toBe(false)
    })

    it('isParseCommandUnimplementedResult, isParseCommandUnknownResult, and isParseCommandPromptInjectionAttemptResult require confidence', () => {
        expect(isParseCommandUnimplementedResult({ type: 'Unimplemented', confidence: 0.5 })).toBe(true)
        expect(isParseCommandUnimplementedResult({ type: 'Unimplemented' } as any)).toBe(false)
        expect(isParseCommandUnknownResult({ type: 'Unknown', confidence: 0.2 })).toBe(true)
        expect(isParseCommandUnknownResult({ type: 'Unknown' } as any)).toBe(false)
        expect(isParseCommandPromptInjectionAttemptResult({ type: 'PromptInjectionAttempt', confidence: 0.6 })).toBe(true)
        expect(isParseCommandPromptInjectionAttemptResult({ type: 'PromptInjectionAttempt' } as any)).toBe(false)
        expect(isParseCommandPromptInjectionAttemptResult({ type: 'PromptInjectionAttempt', confidence: 1.2 })).toBe(false)
    })

    it('isParseCommandErrorResult does not require confidence', () => {
        expect(isParseCommandErrorResult({ type: 'Error' })).toBe(true)
        expect(isParseCommandErrorResult({ type: 'Error', errorMessage: 'x' })).toBe(true)
    })
})

describe('buildParseCommandIntentClassificationPrompt', () => {
    it('embeds the trimmed command and classification vocabulary', () => {
        const prompt = buildParseCommandIntentClassificationPrompt('  attack troll  ', {
            movementExitLabels: ['north', 'south'],
        })
        expect(prompt).toContain('attack troll')
        expect(prompt).toContain('AwaitRoadRunner')
        expect(prompt).toContain('AcmeOrder')
        expect(prompt).toContain('LookRoom')
        expect(prompt).toContain('NavigationIntent')
        expect(prompt).toContain('Unimplemented')
        expect(prompt).toContain('Unknown')
        expect(prompt).toContain('"type": "AwaitRoadRunner"')
        expect(prompt).toContain('"type": "AcmeOrder"')
        expect(prompt).toContain('"type": "LookRoom"')
        expect(prompt).toContain('"type": "NavigationIntent"')
        expect(prompt).toContain('"type": "Unimplemented"')
        expect(prompt).toContain('"type": "Unknown"')
        expect(prompt).toContain('Available exits from current room: north, south')
        expect(prompt).toContain('later step')
    })

    it('uses placeholder for empty or whitespace-only command', () => {
        expect(buildParseCommandIntentClassificationPrompt('')).toContain('(empty command)')
        expect(buildParseCommandIntentClassificationPrompt('   ')).toContain('(empty command)')
    })

    it('includes no-exit movement guidance when exits are unavailable', () => {
        const prompt = buildParseCommandIntentClassificationPrompt('move please', {
            movementExitLabels: [],
        })
        expect(prompt).toContain('No validated exits are currently available in parser context.')
        expect(prompt).toContain('Server-side parse resolution will validate destination')
    })
})

describe('interpretParseCommandIntentClassificationBody', () => {
    it('accepts bare JSON for AwaitRoadRunner, AcmeOrder intent only, LookRoom, NavigationIntent, Unimplemented, and Unknown', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AwaitRoadRunner","confidence":0.95}'
        )).toEqual({ type: 'AwaitRoadRunner', confidence: 0.95 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"LookRoom","confidence":0.88}'
        )).toEqual({ type: 'LookRoom', confidence: 0.88 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","confidence":0.9}'
        )).toEqual({
            type: 'AcmeOrderIntent',
            confidence: 0.9,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":[],"confidence":0.85}'
        )).toEqual({
            type: 'AcmeOrderIntent',
            confidence: 0.85,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":" north ","confidence":0.77}'
        )).toEqual({
            type: 'NavigationIntent',
            exitCandidate: 'north',
            confidence: 0.77,
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unimplemented","confidence":0.8}'
        )).toEqual({ type: 'Unimplemented', confidence: 0.8 })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"Unknown","confidence":0.25}'
        )).toEqual({ type: 'Unknown', confidence: 0.25 })
    })

    it('rejects AcmeOrder when Step A includes orders array with entries', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["rocket skates"],"confidence":0.9}'
        ).type).toBe('Error')
    })

    it('rejects legacy AcmeOrder order field', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"AcmeOrder","order":"  giant rubber band  ","confidence":0.6}'
        ).type).toBe('Error')
    })

    it('strips markdown fences and tolerates surrounding prose', () => {
        expect(interpretParseCommandIntentClassificationBody(
            'Here is JSON:\n```json\n{"type":"Unknown","confidence":1}\n```'
        )).toEqual({ type: 'Unknown', confidence: 1 })
    })

    it('rejects NavigationIntent routing fields and malformed movement payload', () => {
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":"north","targetId":"ROOM#north","confidence":0.7}'
        )).toEqual({
            type: 'Error',
            errorMessage: 'NavigationIntent must not include room-id routing fields',
        })
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":" ","confidence":0.7}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"NavigationIntent","confidence":0.7}'
        ).type).toBe('Error')
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
            '{"type":"AcmeOrder","confidence":1.2}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"LookRoom","confidence":-0.1}'
        ).type).toBe('Error')
        expect(interpretParseCommandIntentClassificationBody(
            '{"type":"CoyoteEngineTest","confidence":0.9}'
        )).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder (confidence only), LookRoom, NavigationIntent, Unimplemented, or Unknown payload (see prompt)',
        })
    })
})

describe('isCoyoteAffinitiesTestSlashCommand', () => {
    it('matches exact and suffix-with-whitespace forms', () => {
        expect(isCoyoteAffinitiesTestSlashCommand('/test affinities')).toBe(true)
        expect(isCoyoteAffinitiesTestSlashCommand('  /test affinities  ')).toBe(true)
        expect(isCoyoteAffinitiesTestSlashCommand('/test affinities extra')).toBe(true)
        expect(isCoyoteAffinitiesTestSlashCommand('/test affinities  --x')).toBe(true)
    })

    it('does not match typos or missing word boundary after affinities', () => {
        expect(isCoyoteAffinitiesTestSlashCommand('/test affinity')).toBe(false)
        expect(isCoyoteAffinitiesTestSlashCommand('/test affinitiesfoo')).toBe(false)
        expect(isCoyoteAffinitiesTestSlashCommand('/test')).toBe(false)
        expect(isCoyoteAffinitiesTestSlashCommand('order anvil')).toBe(false)
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
    const northRoom = 'ROOM#north' as EphemeraRoomId

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

    it('returns CoyoteAffinitiesTest without Bedrock for /test affinities', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            { command: '/test affinities' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({ type: 'CoyoteAffinitiesTest', confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('returns CoyoteAffinitiesTest for slash with trailing args without Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()

        const result = await parseCommand(
            { command: '  /test affinities verbose  ' },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'CoyoteAffinitiesTest', confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
    })

    it('returns LookRoom without Bedrock for bare look and l (case-insensitive, trim)', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        for (const command of ['look', 'L', '  l  ', '  LOOK  ']) {
            const result = await parseCommand(
                { command },
                { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
            )
            expect(result).toEqual({ type: 'LookRoom', confidence: 1 })
        }
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('returns deterministic Navigation for exact exit name without Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            {
                command: 'north',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({ type: 'Navigation', targetId: northRoom, confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('returns deterministic Navigation for go <exit> with casing and whitespace variants', async () => {
        const invokeBedrockParseCommandImpl = jest.fn()

        const result = await parseCommand(
            {
                command: '  GO   NORTH  ',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({ type: 'Navigation', targetId: northRoom, confidence: 1 })
        expect(invokeBedrockParseCommandImpl).not.toHaveBeenCalled()
    })

    it('falls through to Bedrock when deterministic navigation does not match an exit', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"Unknown","confidence":0.3}',
        })

        await parseCommand(
            {
                command: 'go south',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            { invokeBedrockParseCommandImpl }
        )

        expect(invokeBedrockParseCommandImpl).toHaveBeenCalledTimes(1)
    })

    it('does not treat look at or long as bare look; still invokes Bedrock', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"Unknown","confidence":0.3}',
        })

        await parseCommand({ command: 'look at door' }, { invokeBedrockParseCommandImpl })
        await parseCommand({ command: 'long' }, { invokeBedrockParseCommandImpl })

        expect(invokeBedrockParseCommandImpl).toHaveBeenCalledTimes(2)
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

    it('returns LookRoom from Step A without Acme Step B', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"LookRoom","confidence":0.91}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            { command: 'examine the room' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({ type: 'LookRoom', confidence: 0.91 })
        expect(invokeBedrockParseCommandImpl).toHaveBeenCalledTimes(1)
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('resolves NavigationIntent from Step A into Navigation using room exits', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.64}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn()

        const result = await parseCommand(
            {
                command: 'head north',
                roomExits: [{ normalizedName: 'north', targetId: northRoom }],
            },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({ type: 'Navigation', targetId: northRoom, confidence: 0.64 })
        expect(invokeBedrockAcmeOrderEnrichImpl).not.toHaveBeenCalled()
    })

    it('returns stable Error when NavigationIntent has no exit context', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.64}',
        })

        const result = await parseCommand(
            { command: 'head north', roomExits: [] },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.noExitContext,
        })
    })

    it('returns stable Error when NavigationIntent has no matching exit', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"NavigationIntent","exitCandidate":"south","confidence":0.64}',
        })

        const result = await parseCommand(
            { command: 'head south', roomExits: [{ normalizedName: 'north', targetId: northRoom }] },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.noMatch,
        })
    })

    it('returns stable Error when NavigationIntent is ambiguous across target rooms', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.64}',
        })

        const result = await parseCommand(
            {
                command: 'head north',
                roomExits: [
                    { normalizedName: 'north', targetId: 'ROOM#northA' as EphemeraRoomId },
                    { normalizedName: 'north', targetId: 'ROOM#northB' as EphemeraRoomId },
                ],
            },
            { invokeBedrockParseCommandImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.ambiguousMatch,
        })
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
            body: '{"type":"AcmeOrder","confidence":0.82}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [
                    {
                        valid: true,
                        name: 'dynamite sticks',
                        stableKey: 'dynamite-sticks',
                        affinities: [{ role: 'terminal', aptness: 0.5 }],
                    },
                    {
                        valid: true,
                        name: 'spring',
                        stableKey: 'spring',
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
                    stableKey: 'dynamite-sticks',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
                {
                    valid: true,
                    name: 'spring',
                    stableKey: 'spring',
                    affinities: [{ role: 'trigger', aptness: 0.4 }],
                },
            ],
            confidence: 0.82 * 0.9,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
    })

    it('passes occupiedStableKeys into enrich prompt dynamicSuffix', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","confidence":0.82}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [{
                    valid: true,
                    name: 'rope',
                    stableKey: 'rope',
                    affinities: [{ role: 'delivery', aptness: 0.6 }],
                }],
                confidence: 1,
            }),
        })
        await parseCommand(
            { command: 'order rope', occupiedStableKeys: ['rocket-taken', 'anvil'] },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )
        const parts = invokeBedrockAcmeOrderEnrichImpl.mock.calls[0][0] as {
            dynamicSuffix: string
        }
        expect(parts.dynamicSuffix).toContain('Coyote-wide stable keys already in use')
        expect(parts.dynamicSuffix).toContain('- rocket-taken')
        expect(parts.dynamicSuffix).toContain('- anvil')
    })

    it('parseCommand omits enrich Markdown on AcmeOrder; parseCommandWithEnrichReasoning returns it separately', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","confidence":0.82}',
        })
        const payload = JSON.stringify({
            lines: [{
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                affinities: [{ role: 'delivery', aptness: 0.6 }],
            }],
            confidence: 0.95,
        })
        const body = `## Notes\nCheck catalog.\n\n\`\`\`json\n${payload}\n\`\`\``
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body,
        })

        const deps = { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }

        const result = await parseCommand({ command: 'order rope' }, deps)
        const withReason = await parseCommandWithEnrichReasoning({ command: 'order rope' }, deps)

        expect(result.type).toBe('AcmeOrder')
        if (result.type === 'AcmeOrder') {
            expect(result).not.toHaveProperty('reasoningMarkdown')
            expect(result.orders[0]?.name).toBe('rope')
        }
        expect(withReason.enrichReasoningMarkdown).toContain('Notes')
        expect(withReason.result).toEqual(result)
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(2)
    })

    it('merges per-line: one good enrich line and one unparseable line still returns AcmeOrder with combined confidence', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","confidence":0.82}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [
                    {
                        valid: true,
                        name: 'dynamite sticks',
                        stableKey: 'dynamite-sticks',
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
                    stableKey: 'dynamite-sticks',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
                {
                    valid: true,
                    name: 'line2',
                    stableKey: 'line2',
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
            body: '{"type":"AcmeOrder","confidence":0.75}',
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
                name: 'order anvil from acme',
                stableKey: 'order-anvil-from-acme',
                affinities: [],
                affinitiesFailed: true,
            }],
            confidence: 0.75,
        })
    })

    it('returns AcmeOrder with multi-role enrich for beehive, shovel, and rope line items', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","confidence":0.85}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [
                    {
                        valid: true,
                        name: 'Beehive',
                        stableKey: 'beehive',
                        affinities: [
                            {
                                role: 'influence-road-runner',
                                aptness: 0.7,
                            },
                            { role: 'terminal', aptness: 0.5 },
                        ],
                    },
                    {
                        valid: true,
                        name: 'Entrenching Shovel',
                        stableKey: 'entrenching-shovel',
                        affinities: [
                            {
                                role: 'connect-props',
                                aptness: 0.88,
                            },
                            { role: 'trigger', aptness: 0.42 },
                        ],
                    },
                    {
                        valid: true,
                        name: 'Climbing Rope',
                        stableKey: 'climbing-rope',
                        affinities: [
                            { role: 'delivery', aptness: 0.81 },
                            { role: 'trigger', aptness: 0.55 },
                        ],
                    },
                ],
                confidence: 0.9,
            }),
        })

        const result = await parseCommand(
            { command: 'order BEES!, a trench shovel, and climbing rope from Acme' },
            { invokeBedrockParseCommandImpl, invokeBedrockAcmeOrderEnrichImpl }
        )

        expect(result).toEqual({
            type: 'AcmeOrder',
            orders: [
                {
                    valid: true,
                    name: 'Beehive',
                    stableKey: 'beehive',
                    affinities: [
                        {
                            role: 'influence-road-runner',
                            aptness: 0.7,
                        },
                        { role: 'terminal', aptness: 0.5 },
                    ],
                },
                {
                    valid: true,
                    name: 'Entrenching Shovel',
                    stableKey: 'entrenching-shovel',
                    affinities: [
                        {
                            role: 'connect-props',
                            aptness: 0.88,
                        },
                        { role: 'trigger', aptness: 0.42 },
                    ],
                },
                {
                    valid: true,
                    name: 'Climbing Rope',
                    stableKey: 'climbing-rope',
                    affinities: [
                        { role: 'delivery', aptness: 0.81 },
                        { role: 'trigger', aptness: 0.55 },
                    ],
                },
            ],
            confidence: 0.85 * 0.9,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
    })

    it('runs enrich when Step B returns only invalid catalog lines', async () => {
        const invokeBedrockParseCommandImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"type":"AcmeOrder","confidence":0.8}',
        })
        const invokeBedrockAcmeOrderEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: JSON.stringify({
                lines: [{
                    valid: false,
                    name: 'Justice',
                    errorType: 'Not tangible',
                    affinities: [],
                }],
                confidence: 1,
            }),
        })

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
                affinities: [],
            }],
            confidence: 0.8,
        })
        expect(invokeBedrockAcmeOrderEnrichImpl).toHaveBeenCalledTimes(1)
    })
})
