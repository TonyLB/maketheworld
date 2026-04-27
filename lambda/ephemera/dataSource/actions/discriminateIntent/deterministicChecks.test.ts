import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { deterministicIntentChecks } from './deterministicChecks'

describe('deterministicIntentChecks', () => {
    const northRoom = 'ROOM#north' as EphemeraRoomId

    it('returns CoyoteEngineTest for /test generation commands', () => {
        expect(deterministicIntentChecks({ command: '/test generation' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /test generation verbose ' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
        })
    })

    it('returns CoyoteAffinitiesTest for /test affinities commands', () => {
        expect(deterministicIntentChecks({ command: '/test affinities' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /test affinities --x ' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
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
