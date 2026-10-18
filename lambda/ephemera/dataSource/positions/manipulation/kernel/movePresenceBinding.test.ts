import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { MutationKernelMovePresenceBindingStep } from './kernelStep'
import { movePresenceBinding } from './movePresenceBinding'

const table = 'OBJECT#Table' as EphemeraObjectId
const tray = 'OBJECT#Tray' as EphemeraObjectId
const ball = 'OBJECT#Ball' as EphemeraObjectId
const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId

const id = (name: string) => (name.startsWith('PRESENCE#') ? name : `PRESENCE#${name}`) as any
const entry = (host: EphemeraMembershipHostId, name: string) => ({ host, presence: id(name) }) as any
const cover = (...members: ReturnType<typeof entry>[]): EphemeraPresenceCover => ({ members })
/** A room's Base: hostless, with whatever it lists. */
const roomBase = (host: EphemeraRoomId, ...members: ReturnType<typeof entry>[]) => testLudicGraph(host, {
    nodes: [presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(...members))],
})
const under = (host: EphemeraMembershipHostId, presence = BASE_PRESENCE_ID) => ({ host, presence })

const worldOf = (...graphs: EphemeraLudicGraph[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(graphs.map((graph) => [graph.hostId, graph]))
const move = (step: Partial<MutationKernelMovePresenceBindingStep> & Pick<MutationKernelMovePresenceBindingStep, 'hostId' | 'presence' | 'from' | 'to'>): MutationKernelMovePresenceBindingStep => ({ kind: 'movePresenceBinding', ...step })
const run = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>, step: MutationKernelMovePresenceBindingStep) => {
    const result = movePresenceBinding(graphs, step)
    if ('reasonCode' in result) {
        throw new Error(`expected a move, got ${result.reasonCode}`)
    }
    return result.graphs
}
const bindingsOf = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>, host: EphemeraMembershipHostId) => graphs.get(host)!.presenceNodes
const bindingOf = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>, host: EphemeraMembershipHostId, name: string) => (
    bindingsOf(graphs, host).find(({ universalKey }) => universalKey === id(name) || universalKey === name)
)

describe('movePresenceBinding', () => {
    describe('a whole binding', () => {
        // The Tray sits on the Table, which sits in room A; room B is a second place for the Table.
        const world = () => worldOf(
            roomBase(roomA, entry(table, 't-1')),
            roomBase(roomB),
            testLudicGraph(table, { nodes: [presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1')))] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] })
        )

        it('re-points the binding to the destination, keeping its id and cover, and moves its entry between the parents\' covers', () => {
            const after = run(world(), move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB) }))

            expect(bindingOf(after, table, 't-1')).toEqual(presenceBindingNode('t-1', under(roomB), cover(entry(tray, 'tray-1'))))
            expect(bindingOf(after, roomA, BASE_PRESENCE_ID)!.cover).toEqual(cover())
            expect(bindingOf(after, roomB, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(table, 't-1')))
            // the child still names the binding, so nothing is orphaned
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, id('t-1')))
        })

        it('joins the moved entries into the mover\'s binding already at the destination, and removes the moved binding', () => {
            const joining = worldOf(
                roomBase(roomA, entry(table, 't-1')),
                roomBase(roomB, entry(table, 't-2')),
                testLudicGraph(table, { nodes: [
                    presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1'))),
                    presenceBindingNode('t-2', under(roomB), cover()),
                ] }),
                testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] })
            )

            const after = run(joining, move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB) }))

            expect(bindingsOf(after, table).map(({ universalKey }) => universalKey)).toEqual([id('t-2')])
            expect(bindingOf(after, table, 't-2')!.cover).toEqual(cover(entry(tray, 'tray-1')))
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, id('t-2')))
            expect(bindingOf(after, roomA, BASE_PRESENCE_ID)!.cover).toEqual(cover())
            expect(bindingOf(after, roomB, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(table, 't-2')))
        })

        it('repeats the merge a level down when a child is left holding two bindings under the receiver', () => {
            // The Tray holds a binding under each of the Table's bindings, and the Ball under each of the Tray's.
            const deep = worldOf(
                roomBase(roomA, entry(table, 't-1')),
                roomBase(roomB, entry(table, 't-2')),
                testLudicGraph(table, { nodes: [
                    presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1'))),
                    presenceBindingNode('t-2', under(roomB), cover(entry(tray, 'tray-2'))),
                ] }),
                testLudicGraph(tray, { nodes: [
                    presenceBindingNode('tray-1', under(table, id('t-1')), cover(entry(ball, 'ball-1'))),
                    presenceBindingNode('tray-2', under(table, id('t-2')), cover(entry(ball, 'ball-2'))),
                ] }),
                testLudicGraph(ball, { nodes: [
                    presenceBindingNode('ball-1', under(tray, id('tray-1')), cover()),
                    presenceBindingNode('ball-2', under(tray, id('tray-2')), cover()),
                ] })
            )

            const after = run(deep, move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB) }))

            expect(bindingsOf(after, table).map(({ universalKey }) => universalKey)).toEqual([id('t-2')])
            expect(bindingsOf(after, tray).map(({ universalKey }) => universalKey)).toEqual([id('tray-2')])
            expect(bindingsOf(after, ball).map(({ universalKey }) => universalKey)).toEqual([id('ball-2')])
            expect(bindingOf(after, tray, 'tray-2')).toEqual(presenceBindingNode('tray-2', under(table, id('t-2')), cover(entry(ball, 'ball-2'))))
            expect(bindingOf(after, table, 't-2')!.cover).toEqual(cover(entry(tray, 'tray-2')))
            expect(bindingOf(after, ball, 'ball-2')!.fromHostPresence).toEqual(under(tray, id('tray-2')))
        })
    })

    describe('part of a cover (subCover)', () => {
        const world = () => worldOf(
            roomBase(roomA, entry(table, 't-1')),
            roomBase(roomB),
            testLudicGraph(table, { nodes: [presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1'), entry(ball, 'ball-1')))] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] }),
            testLudicGraph(ball, { nodes: [presenceBindingNode('ball-1', under(table, id('t-1')), cover())] })
        )

        it('mints a binding at the destination for the part, leaves the source in place and re-points the part\'s children', () => {
            const after = run(world(), move({
                hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB),
                subCover: [entry(tray, 'tray-1')], mintedPresence: id('t-new'),
            }))

            expect(bindingOf(after, table, 't-1')).toEqual(presenceBindingNode('t-1', under(roomA), cover(entry(ball, 'ball-1'))))
            expect(bindingOf(after, table, 't-new')).toEqual(presenceBindingNode('t-new', under(roomB), cover(entry(tray, 'tray-1'))))
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, id('t-new')))
            expect(bindingOf(after, ball, 'ball-1')!.fromHostPresence).toEqual(under(table, id('t-1')))
            expect(bindingOf(after, roomB, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(table, 't-new')))
            // the source stays under room A, so room A's entry for it stays
            expect(bindingOf(after, roomA, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(table, 't-1')))
        })

        it('moves the part into the binding the mover already holds at the destination', () => {
            const holding = world()
            const withSecond = worldOf(
                ...[...holding.values()].map((graph) => graph.hostId === table
                    ? graph.addPresenceNode(presenceBindingNode('t-2', under(roomB), cover()))
                    : graph.hostId === roomB ? roomBase(roomB, entry(table, 't-2')) : graph)
            )

            const after = run(withSecond, move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(ball, 'ball-1')] }))

            expect(bindingOf(after, table, 't-2')!.cover).toEqual(cover(entry(ball, 'ball-1')))
            expect(bindingOf(after, ball, 'ball-1')!.fromHostPresence).toEqual(under(table, id('t-2')))
            expect(bindingOf(after, table, 't-1')!.cover).toEqual(cover(entry(tray, 'tray-1')))
        })

        it('leaves the source binding in place when the part empties its cover', () => {
            const after = run(world(), move({
                hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB),
                subCover: [entry(tray, 'tray-1'), entry(ball, 'ball-1')], mintedPresence: id('t-new'),
            }))

            expect(bindingOf(after, table, 't-1')).toEqual(presenceBindingNode('t-1', under(roomA), cover()))
            expect(bindingOf(after, table, 't-new')!.cover).toEqual(cover(entry(tray, 'tray-1'), entry(ball, 'ball-1')))
        })
    })

    describe('to no parent', () => {
        // The Table is placed: Base sits in room A. A second binding of it (`t-1`) sits in room B.
        const placedBase = () => worldOf(
            roomBase(roomA, entry(table, BASE_PRESENCE_ID)),
            roomBase(roomB, entry(table, 't-1')),
            testLudicGraph(table, { nodes: [
                presenceBindingNode(BASE_PRESENCE_ID, under(roomA), cover(entry(ball, 'ball-base'))),
                presenceBindingNode('t-1', under(roomB), cover(entry(tray, 'tray-1'))),
            ] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] }),
            testLudicGraph(ball, { nodes: [presenceBindingNode('ball-base', under(table, BASE_PRESENCE_ID), cover())] })
        )

        it('lands in a new Unplaced, never in a placed Base', () => {
            const after = run(placedBase(), move({ hostId: table, presence: id('t-1'), from: under(roomB), to: null }))

            expect(bindingsOf(after, table).map(({ universalKey }) => universalKey)).toEqual([BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID])
            expect(bindingOf(after, table, UNPLACED_PRESENCE_ID)).toEqual(presenceBindingNode(UNPLACED_PRESENCE_ID, undefined, cover(entry(tray, 'tray-1'))))
            expect(bindingOf(after, table, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(ball, 'ball-base')))
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, UNPLACED_PRESENCE_ID))
            expect(bindingOf(after, roomB, BASE_PRESENCE_ID)!.cover).toEqual(cover())
        })

        it('lands in Base when Base is hostless', () => {
            const hostlessBase = worldOf(
                roomBase(roomB, entry(table, 't-1')),
                testLudicGraph(table, { nodes: [
                    presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(entry(ball, 'ball-base'))),
                    presenceBindingNode('t-1', under(roomB), cover(entry(tray, 'tray-1'))),
                ] }),
                testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] }),
                testLudicGraph(ball, { nodes: [presenceBindingNode('ball-base', under(table, BASE_PRESENCE_ID), cover())] })
            )

            const after = run(hostlessBase, move({ hostId: table, presence: id('t-1'), from: under(roomB), to: null }))

            expect(bindingsOf(after, table).map(({ universalKey }) => universalKey)).toEqual([BASE_PRESENCE_ID])
            expect(bindingOf(after, table, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(ball, 'ball-base'), entry(tray, 'tray-1')))
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, BASE_PRESENCE_ID))
        })

        it('moves a part to Unplaced and leaves the source where it is', () => {
            const after = run(placedBase(), move({ hostId: table, presence: id('t-1'), from: under(roomB), to: null, subCover: [entry(tray, 'tray-1')] }))

            expect(bindingOf(after, table, 't-1')).toEqual(presenceBindingNode('t-1', under(roomB), cover()))
            expect(bindingOf(after, table, UNPLACED_PRESENCE_ID)!.cover).toEqual(cover(entry(tray, 'tray-1')))
            expect(bindingOf(after, roomB, BASE_PRESENCE_ID)!.cover).toEqual(cover(entry(table, 't-1')))
        })

        it('strips Base\'s pointer and absorbs Unplaced when Base itself moves to no parent', () => {
            const withUnplaced = worldOf(...[...placedBase().values()].map((graph) => graph.hostId === table
                ? graph.addPresenceNode(presenceBindingNode(UNPLACED_PRESENCE_ID, undefined, cover(entry(tray, 'tray-u'))))
                : graph.hostId === tray ? graph.addPresenceNode(presenceBindingNode('tray-u', under(table, UNPLACED_PRESENCE_ID), cover())) : graph))

            const after = run(withUnplaced, move({ hostId: table, presence: BASE_PRESENCE_ID, from: under(roomA), to: null }))

            expect(bindingOf(after, table, UNPLACED_PRESENCE_ID)).toBeUndefined()
            expect(bindingOf(after, table, BASE_PRESENCE_ID)).toEqual(presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(entry(ball, 'ball-base'), entry(tray, 'tray-u'))))
            expect(bindingOf(after, tray, 'tray-u')!.fromHostPresence).toEqual(under(table, BASE_PRESENCE_ID))
            expect(bindingOf(after, roomA, BASE_PRESENCE_ID)!.cover).toEqual(cover())
        })

        it('strips the pointer in place when the whole holds no Base (unmigrated data)', () => {
            const legacy = worldOf(
                roomBase(roomA, entry(table, 'legacy')),
                testLudicGraph(table, { nodes: [presenceBindingNode('legacy', under(roomA), cover(entry(tray, 'tray-1')))] }),
                testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('legacy')), cover())] })
            )

            const after = run(legacy, move({ hostId: table, presence: id('legacy'), from: under(roomA), to: null }))

            expect(bindingOf(after, table, 'legacy')).toEqual(presenceBindingNode('legacy', undefined, cover(entry(tray, 'tray-1'))))
            expect(bindingOf(after, roomA, BASE_PRESENCE_ID)!.cover).toEqual(cover())
        })

        it('folds into the whole\'s hostless binding when it holds no Base (unmigrated data)', () => {
            const legacy = worldOf(
                roomBase(roomA, entry(table, 'legacy')),
                testLudicGraph(table, { nodes: [presenceBindingNode('root', undefined, cover()), presenceBindingNode('legacy', under(roomA), cover(entry(tray, 'tray-1')))] }),
                testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('legacy')), cover())] })
            )

            const after = run(legacy, move({ hostId: table, presence: id('legacy'), from: under(roomA), to: null }))

            expect(bindingsOf(after, table).map(({ universalKey }) => universalKey)).toEqual([id('root')])
            expect(bindingOf(after, table, 'root')!.cover).toEqual(cover(entry(tray, 'tray-1')))
            expect(bindingOf(after, tray, 'tray-1')!.fromHostPresence).toEqual(under(table, id('root')))
        })
    })

    describe('a bystander', () => {
        it('writes its own pointer without touching the room graph', () => {
            const character = 'CHARACTER#Alpha' as EphemeraMembershipHostId
            const graphs = worldOf(testLudicGraph(character, { nodes: [presenceBindingNode('c-1', under(roomA), cover())] }))

            const after = run(graphs, move({ hostId: character, presence: id('c-1'), from: under(roomA), to: under(roomB) }))

            expect(bindingOf(after, character, 'c-1')!.fromHostPresence).toEqual(under(roomB))
            expect(after.has(roomA)).toBe(false)
            expect(after.has(roomB)).toBe(false)
        })
    })

    describe('is stale', () => {
        const world = () => worldOf(
            roomBase(roomA, entry(table, 't-1')),
            roomBase(roomB),
            testLudicGraph(table, { nodes: [presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1')))] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('t-1')), cover())] })
        )
        const reasonFor = (step: MutationKernelMovePresenceBindingStep, graphs = world()) => {
            const result = movePresenceBinding(graphs, step)
            return 'reasonCode' in result ? result.reasonCode : 'moved'
        }

        it.each([
            ['the binding is gone', { presence: id('gone'), from: under(roomA), to: under(roomB) }, 'presenceBindingMissing'],
            ['the binding no longer sits under `from`', { presence: id('t-1'), from: under(roomB), to: under(roomA) }, 'presenceBindingMoved'],
            ['the destination binding is gone', { presence: id('t-1'), from: under(roomA), to: under(roomB, id('gone')) }, 'destinationBindingMissing'],
            ['the planner\'s cover is not the stored one', { presence: id('t-1'), from: under(roomA), to: under(roomB), cover: cover() }, 'moveCoverChanged'],
            ['a part names an entry the cover does not list', { presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(ball, 'nope')], mintedPresence: id('t-new') }, 'moveEntryNotCovered'],
            ['a part would be minted with no id', { presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(tray, 'tray-1')] }, 'moveMintMissing'],
            ['a minted id is already taken', { presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(tray, 'tray-1')], mintedPresence: id('t-1') }, 'moveIdCollision'],
            ['a part moves to no parent with no Base to land in', { presence: id('t-1'), from: under(roomA), to: null, subCover: [entry(tray, 'tray-1')] }, 'baseMissing'],
        ])('when %s', (_label, partial, reasonCode) => {
            expect(reasonFor(move({ hostId: table, ...partial } as any))).toBe(reasonCode)
        })

        it('when a child no longer names the binding', () => {
            const moved = worldOf(
                roomBase(roomA, entry(table, 't-1')),
                roomBase(roomB),
                testLudicGraph(table, { nodes: [presenceBindingNode('t-1', under(roomA), cover(entry(tray, 'tray-1')))] }),
                testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', under(table, id('elsewhere')), cover())] })
            )

            expect(reasonFor(move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(tray, 'tray-1')], mintedPresence: id('t-new') }), moved)).toBe('presenceBindingMoved')
        })

        it('when a child\'s host is outside the footprint', () => {
            const without = worldOf(...[...world().values()].filter(({ hostId }) => hostId !== tray))

            expect(reasonFor(move({ hostId: table, presence: id('t-1'), from: under(roomA), to: under(roomB), subCover: [entry(tray, 'tray-1')], mintedPresence: id('t-new') }), without)).toBe('hostNotInFootprint')
        })
    })
})
