import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { resolvePresenceSplit } from './resolvePresenceSplit'

const roomId = 'ROOM#Cafe' as EphemeraRoomId
const plankId = 'OBJECT#Plank' as EphemeraObjectId
const cupId = 'OBJECT#Cup' as EphemeraObjectId
const bookId = 'OBJECT#Book' as EphemeraObjectId
const B = 'PRESENCE#B' as const
const cupEntry = { host: cupId, presence: 'PRESENCE#cup1' as const }
const bookEntry = { host: bookId, presence: 'PRESENCE#book1' as const }

const worldOf = (overrides: Record<string, EphemeraLudicGraph> = {}) => {
    const graphs: Record<string, EphemeraLudicGraph> = {
        [plankId]: testLudicGraph(plankId, { nodes: [presenceBindingNode(B, roomId, { members: [cupEntry, bookEntry, { tag: 'Remainder' }] })] }),
        [cupId]: testLudicGraph(cupId, { nodes: [presenceBindingNode('cup1', { host: plankId, presence: B })] }),
        [bookId]: testLudicGraph(bookId, { nodes: [presenceBindingNode('book1', { host: plankId, presence: B })] }),
        ...overrides,
    }
    return async (host: EphemeraMembershipHostId) => graphs[host] ?? testLudicGraph(host)
}

describe('resolvePresenceSplit', () => {
    it('keeps the unnamed entries and the Remainder on the original, and mints one new binding per group', async () => {
        const result = await resolvePresenceSplit({ whole: plankId, presence: B, moveOut: [[bookId]], getGraph: worldOf() })

        expect(result.ok).toBe(true)
        if (!result.ok) return
        const [original, added, ...rest] = result.op.splitInto
        expect(rest).toEqual([])
        expect(original).toEqual({ presence: B, cover: { members: [cupEntry, { tag: 'Remainder' }] } })
        expect(added.presence).toMatch(/^PRESENCE#.+/)
        expect(added.presence).not.toBe(B)
        expect(added.cover).toEqual({ members: [bookEntry] })
    })

    it.each([
        ['the binding is gone', { presence: 'PRESENCE#nope' as const, moveOut: [[bookId]] }, 'bindingMissing'],
        ['a group is empty', { presence: B, moveOut: [[]] }, 'emptyGroup'],
        ['a member is in two groups', { presence: B, moveOut: [[bookId], [bookId]] }, 'memberInTwoGroups'],
        ['a member is not covered', { presence: B, moveOut: [['OBJECT#Stranger' as EphemeraObjectId]] }, 'memberNotCovered'],
    ])('refuses when %s', async (_label, args, errorCode) => {
        expect(await resolvePresenceSplit({ whole: plankId, getGraph: worldOf(), ...args })).toEqual({ ok: false, errorCode })
    })

    it('refuses a child that holds no binding the cover names, or one that sits under another binding', async () => {
        const unbound = worldOf({ [bookId]: testLudicGraph(bookId, { nodes: [] }) })
        const elsewhere = worldOf({ [bookId]: testLudicGraph(bookId, { nodes: [presenceBindingNode('book1', { host: plankId, presence: 'PRESENCE#other' })] }) })

        expect(await resolvePresenceSplit({ whole: plankId, presence: B, moveOut: [[bookId]], getGraph: unbound })).toEqual({ ok: false, errorCode: 'childBindingMissing' })
        expect(await resolvePresenceSplit({ whole: plankId, presence: B, moveOut: [[bookId]], getGraph: elsewhere })).toEqual({ ok: false, errorCode: 'childBindingMoved' })
    })
})
