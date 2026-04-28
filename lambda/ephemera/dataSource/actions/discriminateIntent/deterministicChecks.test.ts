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
                testOnly: 'clustering',
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

        const tooManyArgs = deterministicIntentChecks({ command: '/test affinities 1 extra' })
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

    it('returns Help only for bare help', () => {
        expect(deterministicIntentChecks({ command: 'help' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  HELP  ' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'help me' })).toBeNull()
    })

    it('returns deterministic Navigation for exact and go-prefixed exit names', () => {
        expect(deterministicIntentChecks({
            command: 'north',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, confidence: 1 })

        expect(deterministicIntentChecks({
            command: '  GO   NORTH  ',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, confidence: 1 })
    })

    it('returns null when deterministic navigation does not resolve', () => {
        expect(deterministicIntentChecks({
            command: 'go south',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toBeNull()
        expect(deterministicIntentChecks({ command: 'go north' })).toBeNull()
    })
})
