import { produce } from 'immer'

import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildHostRelationalEdgeRecreationTransactItems } from './hostRelationalEdgeRecreationTransactItems'

const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('buildHostRelationalEdgeRecreationTransactItems', () => {
    it('recreates a relational edge on a Room host via Meta::Room', () => {
        const items = buildHostRelationalEdgeRecreationTransactItems([{
            hostId: ROOM_ID,
            edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        }]) as any[]

        expect(items).toHaveLength(1)
        expect(items[0].Update.Key).toEqual({ EphemeraId: ROOM_ID, DataCategory: 'Meta::Room' })
        expect(items[0].Update.updateKeys).toEqual(['positionGraph'])

        const draft = produce({
            positionGraph: {
                nodes: [
                    { tag: 'Object', universalKey: GLASS_ID },
                    { tag: 'Object', universalKey: TRAY_ID },
                ],
                edges: [],
            },
        }, (d: any) => { items[0].Update.updateReducer(d) })

        expect(draft.positionGraph?.edges).toEqual([
            { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        ])
    })

    it('recreates a relational edge on a Character host via Meta::Character', () => {
        const items = buildHostRelationalEdgeRecreationTransactItems([{
            hostId: CHARACTER_ID,
            edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        }]) as any[]

        expect(items).toHaveLength(1)
        expect(items[0].Update.Key).toEqual({ EphemeraId: CHARACTER_ID, DataCategory: 'Meta::Character' })

        const draft = produce({
            positionGraph: {
                nodes: [
                    { tag: 'Object', universalKey: GLASS_ID },
                    { tag: 'Object', universalKey: TRAY_ID },
                ],
                edges: [],
            },
        }, (d: any) => { items[0].Update.updateReducer(d) })

        expect(draft.positionGraph?.edges).toEqual([
            { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        ])
    })

    it('preserves relationLabel for Custom-kind edges', () => {
        const items = buildHostRelationalEdgeRecreationTransactItems([{
            hostId: ROOM_ID,
            edge: { from: GLASS_ID, to: TRAY_ID, kind: 'Custom', relationLabel: 'balanced on' },
        }]) as any[]

        const draft = produce({
            positionGraph: {
                nodes: [
                    { tag: 'Object', universalKey: GLASS_ID },
                    { tag: 'Object', universalKey: TRAY_ID },
                ],
                edges: [],
            },
        }, (d: any) => { items[0].Update.updateReducer(d) })

        expect(draft.positionGraph?.edges).toEqual([
            { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'Custom', relationLabel: 'balanced on' },
        ])
    })

    it('is idempotent: does not duplicate an edge already present on the destination graph', () => {
        const items = buildHostRelationalEdgeRecreationTransactItems([{
            hostId: ROOM_ID,
            edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        }]) as any[]

        const draft = produce({
            positionGraph: {
                nodes: [
                    { tag: 'Object', universalKey: GLASS_ID },
                    { tag: 'Object', universalKey: TRAY_ID },
                ],
                edges: [{ tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' }],
            },
        }, (d: any) => { items[0].Update.updateReducer(d) })

        expect(draft.positionGraph?.edges).toEqual([
            { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        ])
    })

    it('builds one transact item per recreation, dispatching per-item by host type', () => {
        const items = buildHostRelationalEdgeRecreationTransactItems([
            { hostId: ROOM_ID, edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' } },
            { hostId: CHARACTER_ID, edge: { from: GLASS_ID, to: TRAY_ID, kind: 'On' } },
        ]) as any[]

        expect(items).toHaveLength(2)
        expect(items[0].Update.Key.DataCategory).toBe('Meta::Room')
        expect(items[1].Update.Key.DataCategory).toBe('Meta::Character')
    })
})
