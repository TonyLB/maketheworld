import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { deterministicIntentChecks } from './deterministicChecks'

describe('deterministicIntentChecks', () => {
    const northRoom = 'ROOM#north' as EphemeraRoomId

    it('returns CoyoteEngineTest for /test generation commands', () => {
        expect(deterministicIntentChecks({ command: '/test generation' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /TEST GENERATION CLUSTERING ' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'candidates',
                harnessRunKind: 'runUntil',
            },
        })
        expect(deterministicIntentChecks({ command: ' /test generation runOnly planSelect 1 ' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                fixtureIndex1Based: 1,
            },
        })
    })

    it('returns Parse error for invalid /test generation tails', () => {
        expect(deterministicIntentChecks({ command: '/test generation verbose' })?.type).toBe('Error')
        expect(deterministicIntentChecks({ command: '/test generation 99' })?.type).toBe('Error')
        expect(deterministicIntentChecks({ command: '/test generation planSelect 99' })?.type).toBe(
            'Error'
        )
        expect(deterministicIntentChecks({ command: '/test generation a b c' })?.type).toBe('Error')
    })

    it('returns CoyoteAffinitiesTest for valid /test affinities commands', () => {
        expect(deterministicIntentChecks({ command: '/test affinities' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /test affinities 3 ' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities verbose' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                verbose: true,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities verbose 3' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
                verbose: true,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities 3 verbose' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
                verbose: true,
            },
        })
    })

    it('returns Parse error for invalid /test affinities tails', () => {
        const badToken = deterministicIntentChecks({ command: '/test affinities abc' })
        expect(badToken).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "abc"'),
        })

        const zero = deterministicIntentChecks({ command: '/test affinities 0' })
        expect(zero).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "0"'),
        })

        const negative = deterministicIntentChecks({ command: '/test affinities -1' })
        expect(negative).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "-1"'),
        })

        const decimal = deterministicIntentChecks({ command: '/test affinities 1.5' })
        expect(decimal).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "1.5"'),
        })

        const outOfRange = deterministicIntentChecks({ command: '/test affinities 99' })
        expect(outOfRange).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Fixture index must be an integer from 1 to 11 (received 99).'),
        })

        const unknownExtra = deterministicIntentChecks({ command: '/test affinities 1 extra' })
        expect(unknownExtra).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "extra"'),
        })

        const tooManyArgs = deterministicIntentChecks({ command: '/test affinities 1 2 verbose' })
        expect(tooManyArgs).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Too many arguments'),
        })
    })

    it('returns LookRoom only for bare look aliases', () => {
        expect(deterministicIntentChecks({ command: 'look' })).toEqual({ type: 'LookRoom', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  L  ' })).toEqual({ type: 'LookRoom', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'look at door' })).toBeNull()
    })

    it('returns PredictHypothesis only for bare predict', () => {
        expect(deterministicIntentChecks({ command: 'predict' })).toEqual({ type: 'PredictHypothesis', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  PREDICT  ' })).toEqual({ type: 'PredictHypothesis', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'predict my plan' })).toBeNull()
        expect(deterministicIntentChecks({ command: 'p' })).toBeNull()
        expect(deterministicIntentChecks({ command: 'prediction' })).toBeNull()
    })

    it('returns Help only for bare help', () => {
        expect(deterministicIntentChecks({ command: 'help' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  HELP  ' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'help me' })).toBeNull()
    })

    it('returns Home only for bare home', () => {
        expect(deterministicIntentChecks({ command: 'home' })).toEqual({ type: 'Home', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  HOME  ' })).toEqual({ type: 'Home', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'go home' })).toBeNull()
    })

    it('returns deterministic Navigation for exact and go-prefixed exit names', () => {
        expect(deterministicIntentChecks({
            command: 'north',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 1 })

        expect(deterministicIntentChecks({
            command: '  GO   NORTH  ',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 1 })
    })

    it('returns null when deterministic navigation does not resolve', () => {
        expect(deterministicIntentChecks({
            command: 'go south',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toBeNull()
        expect(deterministicIntentChecks({ command: 'go north' })).toBeNull()
    })

    describe('manipulation fast paths', () => {
        it('returns ObjectMembershipIntent for minimal take/drop/get verbs', () => {
            expect(deterministicIntentChecks({ command: 'take broom' })).toEqual({
                type: 'ObjectMembershipIntent',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                confidence: 1,
            })
            expect(deterministicIntentChecks({ command: '  DROP   the rope  ' })).toEqual({
                type: 'ObjectMembershipIntent',
                rawObjectSpans: ['rope'],
                verbClass: 'release',
                confidence: 1,
            })
            expect(deterministicIntentChecks({
                command: 'get broom',
                roomObjectLabels: ['broom'],
            })).toEqual({
                type: 'ObjectMembershipIntent',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                confidence: 1,
            })
        })

        it('returns null for get when noun is not in object labels (Acme fall-through)', () => {
            expect(deterministicIntentChecks({
                command: 'get rocket skates',
                roomObjectLabels: ['broom'],
            })).toBeNull()
        })

        it('returns null for paraphrases and verb-only commands', () => {
            expect(deterministicIntentChecks({ command: 'pick up the broom' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'take hold of the crate' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'take' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'drop' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'get' })).toBeNull()
        })
    })
})
