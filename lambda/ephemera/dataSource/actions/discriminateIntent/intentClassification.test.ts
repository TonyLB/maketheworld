import { isParseCommandAcmeOrderIntentResult, isParseCommandNavigationIntentResult, isParseCommandHomeIntentResult } from './baseClasses'
import { buildIntentClassificationPrompt } from './buildIntentClassificationPrompt'
import { interpretIntentClassificationBody } from './intentClassification'

describe('isParseCommandNavigationIntentResult', () => {
    it('accepts valid NavigationIntent shape for intent discrimination', () => {
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

describe('isParseCommandHomeIntentResult', () => {
    it('accepts valid HomeIntent shape for intent discrimination', () => {
        expect(isParseCommandHomeIntentResult({
            type: 'HomeIntent',
            confidence: 0.75,
        })).toBe(true)
    })

    it('rejects invalid confidence', () => {
        expect(isParseCommandHomeIntentResult({
            type: 'HomeIntent',
            confidence: 2,
        })).toBe(false)
    })
})

describe('isParseCommandAcmeOrderIntentResult', () => {
    it('accepts AcmeOrderIntent with non-empty trimmed rawOrders and valid confidence', () => {
        expect(isParseCommandAcmeOrderIntentResult({
            type: 'AcmeOrderIntent',
            rawOrders: ['glue trap'],
            confidence: 0.9,
        })).toBe(true)
    })

    it('rejects missing, empty, untrimmed, or invalid rawOrders', () => {
        expect(isParseCommandAcmeOrderIntentResult({
            type: 'AcmeOrderIntent',
            rawOrders: [],
            confidence: 0.9,
        })).toBe(false)
        expect(isParseCommandAcmeOrderIntentResult({
            type: 'AcmeOrderIntent',
            rawOrders: ['  '],
            confidence: 0.9,
        })).toBe(false)
        expect(isParseCommandAcmeOrderIntentResult({
            type: 'AcmeOrderIntent',
            rawOrders: [' ok ', 'x'],
            confidence: 0.9,
        })).toBe(false)
        expect(isParseCommandAcmeOrderIntentResult({
            type: 'AcmeOrderIntent',
            rawOrders: ['rope'],
            confidence: 2,
        })).toBe(false)
    })
})

describe('buildIntentClassificationPrompt', () => {
    it('embeds the trimmed command and classification vocabulary', () => {
        const prompt = buildIntentClassificationPrompt('  attack troll  ', {
            movementExitLabels: ['north', 'south'],
        })
        expect(prompt).toContain('attack troll')
        expect(prompt).toContain('PromptInjectionAttempt')
        expect(prompt).toContain('MultipleCommands')
        expect(prompt).toContain('AwaitRoadRunner')
        expect(prompt).toContain('AcmeOrder')
        expect(prompt).toContain('LookRoom')
        expect(prompt).toContain('Help')
        expect(prompt).toContain('NavigationIntent')
        expect(prompt).toContain('HomeIntent')
        expect(prompt).toContain('Unimplemented')
        expect(prompt).toContain('Unknown')
        expect(prompt).toContain('"type": "PromptInjectionAttempt"')
        expect(prompt).toContain('"type": "MultipleCommands"')
        expect(prompt).toContain('"type": "AwaitRoadRunner"')
        expect(prompt).toContain('"type": "AcmeOrder"')
        expect(prompt).toContain('"type": "LookRoom"')
        expect(prompt).toContain('"type": "Help"')
        expect(prompt).toContain('"type": "NavigationIntent"')
        expect(prompt).toContain('"type": "HomeIntent"')
        expect(prompt).toContain('"type": "Unimplemented"')
        expect(prompt).toContain('"type": "Unknown"')
        expect(prompt).toContain('Available exits from current room: north, south')
        expect(prompt).toContain('Section G')
        expect(prompt).toContain('order glue trap')
        expect(prompt).toContain('order explosives and bandages')
        expect(prompt).toContain('order explosives and then go north')
        expect(prompt).toContain('go east, after which look around')
        expect(prompt).toContain('"orders": ["<product span>", ...]')
    })

    it('uses placeholder for empty or whitespace-only command', () => {
        expect(buildIntentClassificationPrompt('')).toContain('(empty command)')
        expect(buildIntentClassificationPrompt('   ')).toContain('(empty command)')
    })

    it('includes no-exit movement guidance when exits are unavailable', () => {
        const prompt = buildIntentClassificationPrompt('move please', {
            movementExitLabels: [],
        })
        expect(prompt).toContain('No validated exits are currently available in parser context.')
        expect(prompt).toContain('Server-side parse resolution will validate destination')
    })
})

describe('interpretIntentClassificationBody', () => {
    it('accepts bare JSON for MultipleCommands, PromptInjectionAttempt, AwaitRoadRunner, AcmeOrder with raw orders, LookRoom, Help, NavigationIntent, HomeIntent, Unimplemented, and Unknown', () => {
        expect(interpretIntentClassificationBody(
            '{"type":"MultipleCommands","confidence":0.67}'
        )).toEqual({ type: 'MultipleCommands', confidence: 0.67 })
        expect(interpretIntentClassificationBody(
            '{"type":"PromptInjectionAttempt","confidence":0.82}'
        )).toEqual({ type: 'PromptInjectionAttempt', confidence: 0.82 })
        expect(interpretIntentClassificationBody(
            '{"type":"AwaitRoadRunner","confidence":0.95}'
        )).toEqual({ type: 'AwaitRoadRunner', confidence: 0.95 })
        expect(interpretIntentClassificationBody(
            '{"type":"LookRoom","confidence":0.88}'
        )).toEqual({ type: 'LookRoom', confidence: 0.88 })
        expect(interpretIntentClassificationBody(
            '{"type":"Help","confidence":0.9}'
        )).toEqual({ type: 'Help', confidence: 0.9 })
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["glue trap"],"confidence":0.9}'
        )).toEqual({
            type: 'AcmeOrderIntent',
            rawOrders: ['glue trap'],
            confidence: 0.9,
        })
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["  rocket skates  "],"confidence":0.85}'
        )).toEqual({
            type: 'AcmeOrderIntent',
            rawOrders: ['rocket skates'],
            confidence: 0.85,
        })
        expect(interpretIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":" north ","confidence":0.77}'
        )).toEqual({
            type: 'NavigationIntent',
            exitCandidate: 'north',
            confidence: 0.77,
        })
        expect(interpretIntentClassificationBody(
            '{"type":"HomeIntent","confidence":0.83}'
        )).toEqual({ type: 'HomeIntent', confidence: 0.83 })
        expect(interpretIntentClassificationBody(
            '{"type":"Unimplemented","confidence":0.8}'
        )).toEqual({ type: 'Unimplemented', confidence: 0.8 })
        expect(interpretIntentClassificationBody(
            '{"type":"Unknown","confidence":0.25}'
        )).toEqual({ type: 'Unknown', confidence: 0.25 })
    })

    it('rejects AcmeOrder when orders array is missing, empty, or has invalid entries', () => {
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","confidence":0.9}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":[],"confidence":0.85}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["  "],"confidence":0.85}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":[1],"confidence":0.85}'
        ).type).toBe('Error')
    })

    it('rejects legacy AcmeOrder order field', () => {
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","order":"  giant rubber band  ","confidence":0.6}'
        ).type).toBe('Error')
    })

    it('strips markdown fences and tolerates surrounding prose', () => {
        expect(interpretIntentClassificationBody(
            'Here is JSON:\n```json\n{"type":"Unknown","confidence":1}\n```'
        )).toEqual({ type: 'Unknown', confidence: 1 })
    })

    it('rejects NavigationIntent routing fields and malformed movement payload', () => {
        expect(interpretIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":"north","targetId":"ROOM#north","confidence":0.7}'
        )).toEqual({
            type: 'Error',
            errorMessage: 'NavigationIntent must not include room-id routing fields',
        })
        expect(interpretIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":" ","confidence":0.7}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"NavigationIntent","confidence":0.7}'
        ).type).toBe('Error')
    })

    it('rejects invalid JSON, wrong type, or bad confidence', () => {
        expect(interpretIntentClassificationBody('not json').type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Navigation","targetId":"ROOM#x","confidence":0.9}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Unimplemented"}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Unknown","confidence":2}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"AwaitRoadRunner"}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","confidence":1.2}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"LookRoom","confidence":-0.1}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Help","confidence":-0.1}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"CoyoteEngineTest","confidence":0.9}'
        )).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid MultipleCommands, PromptInjectionAttempt, AwaitRoadRunner, AcmeOrder (orders array of raw spans), LookRoom, Help, NavigationIntent, HomeIntent, Unimplemented, or Unknown payload (see prompt)',
        })
    })

    it('rejects CoyoteAffinitiesTest from model JSON (harness is slash-only)', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteAffinitiesTest', confidence: 0.9 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid MultipleCommands, PromptInjectionAttempt, AwaitRoadRunner, AcmeOrder (orders array of raw spans), LookRoom, Help, NavigationIntent, HomeIntent, Unimplemented, or Unknown payload (see prompt)',
        })
    })

    it('rejects MultipleCommands with invalid or missing confidence', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'MultipleCommands', confidence: 1.01 })
            ).type
        ).toBe('Error')
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'MultipleCommands' })
            ).type
        ).toBe('Error')
    })

    it('accepts Help with confidence in range', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'Help', confidence: 0.72 })
            )
        ).toEqual({ type: 'Help', confidence: 0.72 })
    })

    it('rejects Help with invalid or missing confidence', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'Help', confidence: 1.01 })
            ).type
        ).toBe('Error')
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'Help' })
            ).type
        ).toBe('Error')
    })

    it('accepts PromptInjectionAttempt with confidence in range', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt', confidence: 0.85 })
            )
        ).toEqual({ type: 'PromptInjectionAttempt', confidence: 0.85 })
    })

    it('rejects PromptInjectionAttempt with invalid or missing confidence', () => {
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt', confidence: 1.01 })
            ).type
        ).toBe('Error')
        expect(
            interpretIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt' })
            ).type
        ).toBe('Error')
    })
})
