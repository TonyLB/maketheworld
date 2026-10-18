import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import type { MutationKernelRenamePresenceBindingStep } from './kernelStep'
import { renamePresenceBinding } from './renamePresenceBinding'

const table = 'OBJECT#Table' as EphemeraObjectId
const tray = 'OBJECT#Tray' as EphemeraObjectId
const room = 'ROOM#A' as EphemeraRoomId

const id = (name: string) => `PRESENCE#${name}` as any
const entry = (host: EphemeraMembershipHostId, name: string) => ({ host, presence: id(name) }) as any
const cover = (...members: ReturnType<typeof entry>[]): EphemeraPresenceCover => ({ members })
const worldOf = (...graphs: EphemeraLudicGraph[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(graphs.map((graph) => [graph.hostId, graph]))

// A room whose old hostless binding lists the table; the table's binding lists the tray.
const world = () => worldOf(
    testLudicGraph(room, { nodes: [presenceBindingNode('root', undefined, cover(entry(table, 't-1')))] }),
    testLudicGraph(table, { nodes: [presenceBindingNode('t-1', { host: room, presence: id('root') }, cover(entry(tray, 'tray-1')))] }),
    testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', { host: table, presence: id('t-1') }, cover())] })
)
const step = (overrides: Partial<MutationKernelRenamePresenceBindingStep> = {}): MutationKernelRenamePresenceBindingStep => ({
    kind: 'renamePresenceBinding', hostId: table, from: id('t-1'), to: BASE_PRESENCE_ID, parent: { host: room, presence: id('root') }, childHosts: [tray], ...overrides,
})
const run = (graphs: ReturnType<typeof world>, s: MutationKernelRenamePresenceBindingStep) => {
    const result = renamePresenceBinding(graphs, s)
    if ('reasonCode' in result) {
        throw new Error(`expected a rename, got ${result.reasonCode}`)
    }
    return result.graphs
}
const reason = (graphs: ReturnType<typeof world>, s: MutationKernelRenamePresenceBindingStep) => (renamePresenceBinding(graphs, s) as { reasonCode: string }).reasonCode

describe('renamePresenceBinding', () => {
    it('renames the node, its children\'s pointers and the parent\'s cover entry, keeping the pointer and cover', () => {
        const next = run(world(), step())
        expect(next.get(table)!.presenceNodes).toEqual([
            presenceBindingNode(BASE_PRESENCE_ID, { host: room, presence: id('root') }, cover(entry(tray, 'tray-1'))),
        ])
        expect(next.get(tray)!.presenceNodes[0].fromHostPresence).toEqual({ host: table, presence: BASE_PRESENCE_ID })
        expect(next.get(room)!.presenceNodes[0].cover).toEqual(cover({ host: table, presence: BASE_PRESENCE_ID } as any))
    })

    it('renames a hostless binding with no parent to touch', () => {
        const graphs = worldOf(
            testLudicGraph(room, { nodes: [presenceBindingNode('root', undefined, cover(entry(table, 't-1')))] }),
            testLudicGraph(table, { nodes: [presenceBindingNode('t-1', { host: room, presence: id('root') }, cover(entry(tray, 'tray-1')))] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', { host: table, presence: id('t-1') }, cover())] })
        )
        const next = run(graphs, step({ hostId: room, from: id('root'), parent: undefined, childHosts: [table] }))
        expect(next.get(room)!.presenceNodes[0].universalKey).toBe(BASE_PRESENCE_ID)
        expect(next.get(table)!.presenceNodes[0].fromHostPresence).toEqual({ host: room, presence: BASE_PRESENCE_ID })
        expect(next.get(room)!.presenceNodes[0].cover).toEqual(cover(entry(table, 't-1')))
    })

    it('rewrites a child that no cover lists (a bystander) when it is named in childHosts', () => {
        const alpha = 'CHARACTER#Alpha' as any
        const graphs = worldOf(
            testLudicGraph(room, { nodes: [presenceBindingNode('root', undefined, cover())] }),
            testLudicGraph(alpha, { nodes: [presenceBindingNode('a-1', { host: room, presence: id('root') }, cover())] })
        )
        const next = run(graphs, step({ hostId: room, from: id('root'), parent: undefined, childHosts: [alpha] }))
        expect(next.get(alpha)!.presenceNodes[0].fromHostPresence).toEqual({ host: room, presence: BASE_PRESENCE_ID })
    })

    it('is stale when the binding is gone, the target is taken, or the stored pointer moved', () => {
        expect(reason(world(), step({ from: id('nope') }))).toBe('presenceBindingMissing')
        const taken = worldOf(
            testLudicGraph(room, { nodes: [presenceBindingNode('root', undefined, cover(entry(table, 't-1')))] }),
            testLudicGraph(table, { nodes: [presenceBindingNode('t-1', { host: room, presence: id('root') }, cover(entry(tray, 'tray-1'))), presenceBindingNode(BASE_PRESENCE_ID, undefined, cover())] }),
            testLudicGraph(tray, { nodes: [presenceBindingNode('tray-1', { host: table, presence: id('t-1') }, cover())] })
        )
        expect(reason(taken, step())).toBe('renameTargetTaken')
        expect(reason(world(), step({ parent: { host: room, presence: id('other') } }))).toBe('presenceBindingMoved')
        expect(reason(world(), step({ parent: undefined }))).toBe('presenceBindingMoved')
    })

    it('is stale when a cover entry\'s host is not listed, or a listed host is outside the footprint', () => {
        expect(reason(world(), step({ childHosts: [] }))).toBe('renameChildUnlisted')
        const missing = world()
        missing.delete(tray)
        expect(reason(missing, step())).toBe('hostNotInFootprint')
    })
})

describe('computeStepSequenceFootprint: renamePresenceBinding', () => {
    it('locks the binding\'s host, its parent and every child host', () => {
        expect(computeStepSequenceFootprint([step()], () => undefined)).toEqual(new Set([table, room, tray]))
    })

    it('does not lock a bystander\'s room', () => {
        const alpha = 'CHARACTER#Alpha' as any
        expect(computeStepSequenceFootprint([step({ hostId: alpha, parent: { host: room, presence: id('root') }, childHosts: [] })], () => undefined)).toEqual(new Set([alpha]))
    })
})
