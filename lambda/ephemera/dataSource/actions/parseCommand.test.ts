import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandErrorResult,
    isParseCommandNavigationResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
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
