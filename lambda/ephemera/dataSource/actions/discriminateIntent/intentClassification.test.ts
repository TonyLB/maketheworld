import { buildIntentClassificationPrompt } from './buildIntentClassificationPrompt'
import { interpretIntentClassificationBody } from './intentClassification'

describe('buildIntentClassificationPrompt', () => {
    it('embeds the trimmed command and the narrowed (iteration 7) classification vocabulary', () => {
        const prompt = buildIntentClassificationPrompt('  attack troll  ')
        expect(prompt).toContain('attack troll')
        expect(prompt).toContain('PromptInjectionAttempt')
        expect(prompt).toContain('MultipleCommands')
        expect(prompt).toContain('Command')
        expect(prompt).toContain('WorldQuestion')
        expect(prompt).toContain('Unknown')
        expect(prompt).toContain('"type": "Command"')
        expect(prompt).toContain('"type": "WorldQuestion"')
        expect(prompt).toContain('"type": "MultipleCommands"')
        expect(prompt).toContain('"type": "PromptInjectionAttempt"')
        expect(prompt).toContain('"type": "Unknown"')
        expect(prompt).toContain('Section A')
        expect(prompt).toContain('Section A2')
        expect(prompt).toContain('Section B')
        expect(prompt).toContain('Section C')
        expect(prompt).toContain('Section D')
        expect(prompt).toContain("what's my plan")
        expect(prompt).toContain('order glue trap')
        expect(prompt).toContain('order explosives and then go north')
        expect(prompt).toContain('go east, after which look around')
    })

    it('uses placeholder for empty or whitespace-only command', () => {
        expect(buildIntentClassificationPrompt('')).toContain('(empty command)')
        expect(buildIntentClassificationPrompt('   ')).toContain('(empty command)')
    })

    it('does not take a second argument (movement/object-label context is retired)', () => {
        // The narrowed classify prompt no longer decides command family, so exit/object
        // context is irrelevant to it --- buildIntentClassificationPrompt now takes only
        // the command string.
        const prompt = buildIntentClassificationPrompt('go north')
        expect(prompt).not.toContain('Available exits from current room')
        expect(prompt).not.toContain('Objects currently in the room or held by the character')
    })
})

describe('interpretIntentClassificationBody', () => {
    it('accepts bare JSON for Command, WorldQuestion, MultipleCommands, PromptInjectionAttempt, and Unknown', () => {
        expect(interpretIntentClassificationBody(
            '{"type":"Command","confidence":0.93}'
        )).toEqual({ type: 'Command', confidence: 0.93 })
        expect(interpretIntentClassificationBody(
            '{"type":"WorldQuestion","confidence":0.87}'
        )).toEqual({ type: 'WorldQuestion', confidence: 0.87 })
        expect(interpretIntentClassificationBody(
            '{"type":"MultipleCommands","confidence":0.67}'
        )).toEqual({ type: 'MultipleCommands', confidence: 0.67 })
        expect(interpretIntentClassificationBody(
            '{"type":"PromptInjectionAttempt","confidence":0.82}'
        )).toEqual({ type: 'PromptInjectionAttempt', confidence: 0.82 })
        expect(interpretIntentClassificationBody(
            '{"type":"Unknown","confidence":0.25}'
        )).toEqual({ type: 'Unknown', confidence: 0.25 })
    })

    it('strips markdown fences and tolerates surrounding prose', () => {
        expect(interpretIntentClassificationBody(
            'Here is JSON:\n```json\n{"type":"Unknown","confidence":1}\n```'
        )).toEqual({ type: 'Unknown', confidence: 1 })
    })

    it('rejects invalid JSON, non-object JSON, or missing/invalid confidence', () => {
        expect(interpretIntentClassificationBody('not json').type).toBe('Error')
        expect(interpretIntentClassificationBody('[1,2,3]').type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Command"}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Command","confidence":2}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"WorldQuestion","confidence":-0.1}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"MultipleCommands"}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"PromptInjectionAttempt","confidence":1.01}'
        ).type).toBe('Error')
        expect(interpretIntentClassificationBody(
            '{"type":"Unknown","confidence":2}'
        ).type).toBe('Error')
    })

    it('rejects retired family-specific and other unknown type values with the narrowed error message', () => {
        const expected = {
            type: 'Error',
            errorMessage: 'Model JSON must be a valid Command, WorldQuestion, MultipleCommands, PromptInjectionAttempt, or Unknown payload (see prompt)',
        }
        expect(interpretIntentClassificationBody(
            '{"type":"NavigationIntent","exitCandidate":"north","confidence":0.7}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"HomeIntent","confidence":0.7}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"AwaitRoadRunner","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"PredictHypothesis","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"Help","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrder","orders":["glue trap"],"confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"AcmeOrderIntent","rawOrders":["glue trap"],"confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"ObjectMembershipIntent","verbClass":"acquire","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"ObjectRelateIntent","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"LookRoom","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"Unimplemented","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"CoyoteEngineTest","confidence":0.9}'
        )).toEqual(expected)
        expect(interpretIntentClassificationBody(
            '{"type":"CoyoteAffinitiesTest","confidence":0.9}'
        )).toEqual(expected)
    })
})
