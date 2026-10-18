import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'

jest.mock('../kernel/commitStepSequence', () => ({ __esModule: true, commitStepSequence: jest.fn() }))
jest.mock('../../ludicCache/charactersRow', () => ({ __esModule: true, readRoomCharacters: jest.fn() }))
jest.mock('../../../../internalCache', () => ({ __esModule: true, default: { Positions: { getLudicGraph: jest.fn() } } }))

import internalCache from '../../../../internalCache'
import { readRoomCharacters } from '../../ludicCache/charactersRow'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { migrateBaseAtCache } from './migrateBaseAtCache'
import { migrateBaseBinding } from './migrateBaseBinding'

const ROOM = 'ROOM#Kitchen' as EphemeraRoomId
const STOVE = 'FEATURE#Stove' as EphemeraFeatureId
const SINK = 'FEATURE#Sink' as EphemeraFeatureId
const ALPHA = 'CHARACTER#Alpha' as EphemeraCharacterId
const OLD = 'PRESENCE#kitchen-root' as any
const remainder = { members: [{ tag: 'Remainder' as const }] }
const entry = (host: string, presence: string) => ({ host, presence }) as any
const under = (presence: string) => ({ host: ROOM, presence: presence as any })

const room = (cover = remainder, rootId: string = OLD) => testLudicGraph(ROOM, {
    nodes: [{ tag: 'Room', universalKey: ROOM }, { tag: 'Feature', universalKey: STOVE }, { tag: 'Feature', universalKey: SINK }, presenceBindingNode(rootId, undefined, cover as any)],
})
const feature = (id: EphemeraFeatureId, parentPresence: string = OLD) => testLudicGraph(id, { nodes: [presenceBindingNode(id === STOVE ? 'stove-b' : 'sink-b', under(parentPresence), { members: [] })] })
const lookup = (...graphs: EphemeraLudicGraph[]) => (host: string) => graphs.find((graph) => graph.hostId === host)

describe('migrateBaseBinding', () => {
    it('renames the root to Base and lists every member the Remainder covered, from the members\' own pointers', () => {
        expect(migrateBaseBinding(room(), lookup(feature(STOVE), feature(SINK)), [ALPHA])).toEqual([{
            kind: 'renamePresenceBinding',
            hostId: ROOM,
            from: OLD,
            to: BASE_PRESENCE_ID,
            cover: { members: [entry(STOVE, 'PRESENCE#stove-b'), entry(SINK, 'PRESENCE#sink-b')] },
            childHosts: [STOVE, SINK, ALPHA],
        }])
    })

    it('keeps entries already listed and expands only the unlisted members', () => {
        const listed = { members: [entry(STOVE, 'PRESENCE#stove-b'), { tag: 'Remainder' as const }] }
        const [step] = migrateBaseBinding(room(listed), lookup(feature(STOVE), feature(SINK)))
        expect(step.cover).toEqual({ members: [entry(STOVE, 'PRESENCE#stove-b'), entry(SINK, 'PRESENCE#sink-b')] })
    })

    it('renames only, leaving the cover, for a root with explicit entries; carries the stored pointer as parent', () => {
        const explicit = { members: [entry(STOVE, 'PRESENCE#stove-b'), entry(SINK, 'PRESENCE#sink-b')] }
        const [step] = migrateBaseBinding(room(explicit), lookup(feature(STOVE), feature(SINK)))
        expect(step).not.toHaveProperty('cover')
        expect(step).not.toHaveProperty('parent')
    })

    it('plans nothing when a member holds no binding into the root, holds two, or cannot be read', () => {
        expect(migrateBaseBinding(room(), lookup(feature(STOVE, 'PRESENCE#elsewhere'), feature(SINK)))).toEqual([])
        const two = testLudicGraph(STOVE, { nodes: [presenceBindingNode('a', under(OLD), { members: [] }), presenceBindingNode('b', under(OLD), { members: [] })] })
        expect(migrateBaseBinding(room(), lookup(two, feature(SINK)))).toEqual([])
        expect(migrateBaseBinding(room(), lookup(feature(STOVE)))).toEqual([])
    })

    it('plans nothing for a migrated whole, a whole with no binding, or an ambiguous one', () => {
        expect(migrateBaseBinding(room({ members: [] }, BASE_PRESENCE_ID), lookup())).toEqual([])
        expect(migrateBaseBinding(testLudicGraph(STOVE, { nodes: [{ tag: 'Feature', universalKey: STOVE }] }), lookup())).toEqual([])
        const two = testLudicGraph(STOVE, { nodes: [presenceBindingNode('a', under(OLD), remainder as any), presenceBindingNode('b', under(OLD), remainder as any)] })
        expect(migrateBaseBinding(two, lookup())).toEqual([])
    })

    it('carries a placed non-room whole\'s pointer as the parent', () => {
        const placed = testLudicGraph(STOVE, { nodes: [presenceBindingNode('only', under('PRESENCE#Base'), { members: [] })] })
        expect(migrateBaseBinding(placed, lookup())).toEqual([{
            kind: 'renamePresenceBinding', hostId: STOVE, from: 'PRESENCE#only', to: BASE_PRESENCE_ID, parent: under('PRESENCE#Base'), childHosts: [],
        }])
    })
})

describe('migrateBaseAtCache', () => {
    const deps = { messageBus: { publish: jest.fn() } as any, streamEvent: jest.fn() }
    const withGraphs = (...graphs: EphemeraLudicGraph[]) => {
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) => {
            const found = graphs.find((graph) => graph.hostId === hostId)
            if (!found) {
                throw new Error(`no graph ${hostId}`)
            }
            return found
        })
    }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(commitStepSequence as jest.Mock).mockResolvedValue({ ok: true, steps: [], captures: new Map() })
        ;(readRoomCharacters as jest.Mock).mockResolvedValue([ALPHA])
    })

    it('commits the rename for an unmigrated Room, naming the characters row\'s characters as children', async () => {
        withGraphs(room(), feature(STOVE), feature(SINK))
        await migrateBaseAtCache(ROOM, deps)
        const steps = (commitStepSequence as jest.Mock).mock.calls[0][0].steps
        expect(steps).toHaveLength(1)
        expect(steps[0]).toMatchObject({ kind: 'renamePresenceBinding', hostId: ROOM, from: OLD, to: BASE_PRESENCE_ID, childHosts: [STOVE, SINK, ALPHA] })
    })

    it('commits nothing for a migrated Room, or when a member cannot be read', async () => {
        withGraphs(room({ members: [entry(STOVE, 'PRESENCE#stove-b'), entry(SINK, 'PRESENCE#sink-b')] as any }, BASE_PRESENCE_ID), feature(STOVE, BASE_PRESENCE_ID), feature(SINK, BASE_PRESENCE_ID))
        await migrateBaseAtCache(ROOM, deps)
        withGraphs(room(), feature(STOVE))
        const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        await migrateBaseAtCache(ROOM, deps)
        errors.mockRestore()
        expect(commitStepSequence).not.toHaveBeenCalled()
    })
})
