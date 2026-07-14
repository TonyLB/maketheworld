import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/ungroundedPrimitive'
import { groundReferent, type GroundingContext, type ResolvedSpan } from './groundReferent'

const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const baseContext = (resolvedSpans: ReadonlyMap<string, ResolvedSpan>): GroundingContext => ({
    actingCharacterId: CHARACTER_ID,
    resolvedSpans,
    getCurrentHost: (componentId) => (componentId === TRAY_ID ? ROOM_ID : undefined),
})

describe('groundReferent', () => {
    it('resolves an objectSpan referent from a resolved span', () => {
        const context = baseContext(new Map([['tray', { verdict: 'resolved', objectId: TRAY_ID }]]))

        expect(groundReferent(objectSpanRef('tray'), context)).toEqual({ ok: true, value: TRAY_ID })
    })

    it('fails when a span verdict is unresolved', () => {
        const context = baseContext(new Map([['tray', { verdict: 'unresolved', reason: 'ambiguous' }]]))

        expect(groundReferent(objectSpanRef('tray'), context)).toEqual({ ok: false, reason: 'ambiguous' })
    })

    it('fails when a span has no supplied resolution at all', () => {
        const context = baseContext(new Map())

        const result = groundReferent(objectSpanRef('tray'), context)
        expect(result.ok).toBe(false)
    })

    it('resolves actingCharacter to the context character id', () => {
        const context = baseContext(new Map())

        expect(groundReferent(actingCharacterRef, context)).toEqual({ ok: true, value: CHARACTER_ID })
    })

    it('resolves currentHost(objectSpan) by grounding the inner referent then looking up its host', () => {
        const context = baseContext(new Map([['tray', { verdict: 'resolved', objectId: TRAY_ID }]]))

        expect(groundReferent(currentHostRef(objectSpanRef('tray')), context)).toEqual({ ok: true, value: ROOM_ID })
    })

    it('propagates a failure from the inner referent of currentHost', () => {
        const context = baseContext(new Map())

        const result = groundReferent(currentHostRef(objectSpanRef('tray')), context)
        expect(result.ok).toBe(false)
    })

    it('fails cleanly when getCurrentHost has no host for the grounded id', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map(),
            getCurrentHost: () => undefined,
        }

        const result = groundReferent(currentHostRef(actingCharacterRef), context)
        expect(result.ok).toBe(false)
    })

    it('resolves one level of nested currentHost(currentHost(...)) recursion', () => {
        const context: GroundingContext = {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map(),
            getCurrentHost: (componentId) => (componentId === CHARACTER_ID ? ROOM_ID : undefined),
        }

        // currentHost(currentHost(actingCharacter)) --- nothing upstream constructs this yet,
        // but the type allows it, so the recursion itself must not break.
        const result = groundReferent(currentHostRef(currentHostRef(actingCharacterRef)), {
            ...context,
            getCurrentHost: (componentId) => {
                if (componentId === CHARACTER_ID) return ROOM_ID
                if (componentId === ROOM_ID) return ROOM_ID
                return undefined
            },
        })
        expect(result).toEqual({ ok: true, value: ROOM_ID })
    })
})
