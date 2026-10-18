/**
 * The invalidation-completeness property of the stored `ludicCache`.
 *
 * A stored `ludicCache` row is a hit exactly when it is labelled with the room's marker, and a hit is
 * trusted. So the only way the design returns a wrong answer is a write that changes what a room's
 * cache would say and forgets to bump that room's marker. The property: *after every kind of change,
 * `readLudicCache` equals a cold `buildLudicCache`*, and the room's marker moved.
 *
 * Every change runs through its real writer (`commitStepSequence`, the diagnostics heals, the Coyote
 * clear, and the `Component Updated` / `Zone Updated` handlers in `dataSource/index.ts`). Only the
 * DynamoDB leaf is in memory: `ephemeraDB.transactWrite` applies the kernel's `MultiKeyUpdate`
 * reducer **and its `cascade` items** (adjacency rows, created hosts, and the marker bumps), and
 * `strictPrimitiveUpdate` applies the plain bumps. A fake that ignored the cascade would pass this
 * suite vacuously, so the marker bump is applied by parsing the real `PrimitiveUpdate`, and a case
 * marked `changesCache` must also prove the change was visible in the cache at all.
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../messageBus', () => ({
    __esModule: true,
    default: { send: jest.fn(), publish: jest.fn(), flush: jest.fn(), subscribe: jest.fn() },
}))
jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    kickRoomHeaderBroadcastForRoom: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../manipulation/containment/removeAuthoredObject', () => ({
    removeAuthoredObject: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { remainderCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import internalCache from '../../../internalCache'
import messageBus from '../../../messageBus'
import { ephemeraDataSource } from '../../index'
import { EphemeraLudicGraph, graphFromMeta } from '../ludicGraph'
import { healLudicGraphStructure } from '../ludicGraph/healLudicGraphStructure'
import { parentHostOf } from '../ludicGraph/presenceParent'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../ludicGraph/testFixtures'
import { commitStepSequence } from '../manipulation/kernel/commitStepSequence'
import { mutationKernelStepKinds, type MutationKernelStep } from '../manipulation/kernel/kernelStep'
import { populateContainmentAtCache } from '../manipulation/containment/populateContainmentAtCache'
import { persistClearStoredLudicGraphs } from '../../objects/persistClearStoredLudicGraphs'
import { buildLudicCache } from './fold'
import { LUDIC_CACHE_CHARACTERS_DATA_CATEGORY, bindingIdsInto, readRoomCharacters } from './charactersRow'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraLudicCacheData } from './types'
import {
    LUDIC_CACHE_VERSION_DATA_CATEGORY,
    readLudicCacheWithOutcome,
    type LudicCacheReadOutcome,
    type LudicCacheRow,
} from './store'

const R1 = 'ROOM#Cafe' as EphemeraRoomId
const R2 = 'ROOM#Terrace' as EphemeraRoomId
const TABLE = 'OBJECT#Table' as EphemeraObjectId
const CUP = 'OBJECT#Cup' as EphemeraObjectId
const SAUCER = 'OBJECT#Saucer' as EphemeraObjectId
const BOX = 'OBJECT#Box' as EphemeraObjectId
const LAMP = 'OBJECT#Lamp' as EphemeraObjectId
const MUG = 'OBJECT#Mug' as EphemeraObjectId
const ALPHA = 'CHARACTER#Alpha' as EphemeraCharacterId

const CANON_STACK = ['ASSET#canon']

const ref = (host: EphemeraMembershipHostId, presence: string) => ({ host, presence: presence as any })
const remainder = (host: EphemeraMembershipHostId) => ref(host, parentRemainderKey(host))
const entry = (host: EphemeraMembershipHostId, presence: string) => ({ host, presence: presence as any })

/** The DynamoDB leaf, held in memory. */
type World = {
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>
    markers: Map<EphemeraRoomId, number>
    rows: Map<EphemeraRoomId, { builtAtVersion: number; cache: LudicCacheRow['cache'] }>
    /** Each room's `LudicCache::Characters` row (one membership attribute per present character). */
    characterRows: Map<EphemeraRoomId, Record<string, unknown>>
    names: Record<string, string>
    /** Which rooms the asset (by id) is used by, for a zone change. */
    assetRooms: Record<string, EphemeraRoomId[]>
}

const hostBinding = (name: string, parent: EphemeraMembershipHostId | ReturnType<typeof ref>, members: any[] = [{ tag: 'Remainder' }]) => (
    presenceBindingNode(name, parent as any, { members } as any)
)

/**
 * Cafe holds a table (a cup and a saucer on it), a box and Alpha; Terrace is empty. Built in the
 * shapes the kernel's own tests use, so every step in this suite is legal against it.
 */
const freshWorld = (): World => {
    const room = (id: EphemeraRoomId, ...nodes: any[]) => testLudicGraph(id, { nodes: [{ tag: 'Room', universalKey: id }, ...nodes, presenceBindingNode(parentRemainderKey(id))] })
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [R1, room(R1, { tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: BOX })],
        [R2, room(R2)],
        [TABLE, testLudicGraph(TABLE, {
            nodes: [
                { tag: 'Object', universalKey: TABLE },
                { tag: 'Object', universalKey: CUP },
                { tag: 'Object', universalKey: SAUCER },
                hostBinding('tbl', R1, [entry(CUP, 'PRESENCE#cup1'), entry(SAUCER, 'PRESENCE#sau1'), { tag: 'Remainder' }]),
            ],
        })],
        [CUP, testLudicGraph(CUP, { nodes: [{ tag: 'Object', universalKey: CUP }, hostBinding('cup1', ref(TABLE, 'PRESENCE#tbl'))] })],
        [SAUCER, testLudicGraph(SAUCER, { nodes: [{ tag: 'Object', universalKey: SAUCER }, hostBinding('sau1', ref(TABLE, 'PRESENCE#tbl'))] })],
        [BOX, testLudicGraph(BOX, { nodes: [{ tag: 'Object', universalKey: BOX }, hostBinding('Base', R1)] })],
        [ALPHA, testLudicGraph(ALPHA as any, { nodes: [hostBinding('Base', R1)] })],
        [LAMP, testLudicGraph(LAMP, { nodes: [{ tag: 'Object', universalKey: LAMP }, presenceBindingNode('lamp1')] })],
    ])
    return {
        graphs,
        markers: new Map(),
        rows: new Map(),
        characterRows: new Map<EphemeraRoomId, Record<string, unknown>>([
            [R1, { [ALPHA]: ['PRESENCE#Base'] }],
            [R2, {}],
        ]),
        names: { [TABLE]: 'Table', [CUP]: 'Cup', [SAUCER]: 'Saucer', [BOX]: 'Box', [LAMP]: 'Lamp', [MUG]: 'Mug', [R1]: 'Cafe', [R2]: 'Terrace', [ALPHA]: 'Alpha' },
        assetRooms: { 'ASSET#test-asset': [R1, R2] },
    }
}

/**
 * Cafe where the table's binding is already split in two (cup under `tbl`, saucer under `tbl2`),
 * the state a join starts from.
 */
const splitTableWorld = (): World => {
    const world = freshWorld()
    world.graphs.set(TABLE, testLudicGraph(TABLE, {
        nodes: [
            { tag: 'Object', universalKey: TABLE },
            { tag: 'Object', universalKey: CUP },
            { tag: 'Object', universalKey: SAUCER },
            hostBinding('tbl', R1, [entry(CUP, 'PRESENCE#cup1'), { tag: 'Remainder' }]),
            hostBinding('tbl2', R1, [entry(SAUCER, 'PRESENCE#sau1')]),
        ],
    }))
    world.graphs.set(SAUCER, testLudicGraph(SAUCER, { nodes: [{ tag: 'Object', universalKey: SAUCER }, hostBinding('sau1', ref(TABLE, 'PRESENCE#tbl2'))] }))
    return world
}

let world: World

const emptyGraph = (hostId: EphemeraMembershipHostId) => testLudicGraph(hostId, { nodes: [] })
const freshGraph = async (hostId: EphemeraMembershipHostId) => world.graphs.get(hostId) ?? emptyGraph(hostId)

const getComponentAggregate = async ([perspective]: { universalKey: string; mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => (
    world.names[perspective.universalKey]
        ? [mergedComponentResult({
            universalKey: perspective.universalKey as EphemeraObjectId,
            merged: new StandardObject({ tag: 'Object', shortName: world.names[perspective.universalKey] }),
            mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
        })]
        : []
)

const bump = (roomId: EphemeraRoomId) => world.markers.set(roomId, (world.markers.get(roomId) ?? 0) + 1)

/**
 * The bump a writer sends, applied the way DynamoDB would: only the exact `ADD version :one` on a
 * `LudicCacheVersion::` row, so a bump that targets the wrong row or attribute does not count.
 */
const applyPrimitiveUpdate = (update: { Key: { EphemeraId: string; DataCategory: string }; UpdateExpression: string }) => {
    if (update.Key.DataCategory !== LUDIC_CACHE_VERSION_DATA_CATEGORY || update.UpdateExpression !== 'ADD version :one') {
        throw new Error(`unexpected PrimitiveUpdate in a kernel cascade: ${JSON.stringify(update)}`)
    }
    bump(update.Key.EphemeraId as EphemeraRoomId)
}

/**
 * A kernel cascade's `LudicCache::Characters` write, applied the way DynamoDB would: parses the real
 * `SET #cN = :bN, ... REMOVE #rN, ...` through the item's own placeholders, and throws on anything
 * it cannot account for, so a malformed expression cannot pass by being ignored. A `SET` on an absent
 * row creates it *without* `complete`, as DynamoDB does.
 */
const applyCharactersRowUpdate = (update: { Key: { EphemeraId: string }; UpdateExpression: string; ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, unknown> }) => {
    const roomId = update.Key.EphemeraId as EphemeraRoomId
    const names = update.ExpressionAttributeNames ?? {}
    const values = update.ExpressionAttributeValues ?? {}
    const [setPart, removePart] = update.UpdateExpression.split(' REMOVE ')
    const setClauses = setPart.startsWith('SET ') ? setPart.slice(4).split(', ') : []
    const removeClauses = removePart !== undefined ? removePart.split(', ') : setPart.startsWith('REMOVE ') ? setPart.slice(7).split(', ') : []
    if (setClauses.length + removeClauses.length === 0) {
        throw new Error(`unparseable characters-row update: ${update.UpdateExpression}`)
    }
    const row = { ...(world.characterRows.get(roomId) ?? {}) }
    for (const clause of setClauses) {
        const [, name, value] = /^(#c\d+) = (:b\d+)$/.exec(clause) ?? []
        if (!name || !(name in names) || !(value in values)) {
            throw new Error(`unparseable characters-row SET clause: ${clause}`)
        }
        row[names[name]] = structuredClone(values[value])
    }
    for (const clause of removeClauses) {
        if (!/^#r\d+$/.test(clause) || !(clause in names)) {
            throw new Error(`unparseable characters-row REMOVE clause: ${clause}`)
        }
        delete row[names[clause]]
    }
    world.characterRows.set(roomId, row)
}

/** `transactWrite`'s `MultiKeyUpdate`: fetch the keys, run the reducer, write back, then the cascade. */
const applyTransact = async (items: any[]): Promise<void> => {
    for (const item of items) {
        const multi = item.MultiKeyUpdate
        if (!multi) {
            throw new Error(`unexpected transact item: ${Object.keys(item).join(',')}`)
        }
        const draft: Record<string, any> = {}
        for (const key of multi.Keys as { EphemeraId: EphemeraMembershipHostId; DataCategory: string }[]) {
            const graph = world.graphs.get(key.EphemeraId)
            if (!graph) {
                throw new Error(`transact: no row for ${key.EphemeraId}`)
            }
            draft[`${key.EphemeraId}#${key.DataCategory}`] = { EphemeraId: key.EphemeraId, DataCategory: key.DataCategory, ludicGraph: graph.toStored() }
        }
        const prior = structuredClone(draft)
        multi.reducer(draft)
        const cascade: any[] = multi.cascade?.(prior, draft) ?? []
        for (const key of multi.Keys as { EphemeraId: EphemeraMembershipHostId; DataCategory: string }[]) {
            const written = draft[`${key.EphemeraId}#${key.DataCategory}`]
            if (written) {
                world.graphs.set(key.EphemeraId, graphFromMeta(written, key.EphemeraId))
            }
            else {
                world.graphs.delete(key.EphemeraId)
            }
        }
        for (const extra of cascade) {
            if (extra.PrimitiveUpdate?.Key.DataCategory === LUDIC_CACHE_CHARACTERS_DATA_CATEGORY) {
                applyCharactersRowUpdate(extra.PrimitiveUpdate)
            }
            else if (extra.PrimitiveUpdate) {
                applyPrimitiveUpdate(extra.PrimitiveUpdate)
            }
            else if (extra.Put && 'ludicGraph' in extra.Put) {
                world.graphs.set(extra.Put.EphemeraId, graphFromMeta(extra.Put, extra.Put.EphemeraId))
            }
        }
    }
}

/** `optimisticUpdate` on a host row, as the heals and the Coyote clear write. */
const applyOptimisticUpdate = async ({ Key, updateReducer }: any): Promise<void> => {
    const graph = world.graphs.get(Key.EphemeraId)
    const draft: Record<string, any> = { EphemeraId: Key.EphemeraId, DataCategory: Key.DataCategory, ...(graph ? { ludicGraph: graph.toStored() } : {}) }
    updateReducer(draft)
    if (draft.ludicGraph === undefined) {
        world.graphs.delete(Key.EphemeraId)
    }
    else {
        world.graphs.set(Key.EphemeraId, graphFromMeta(draft, Key.EphemeraId))
    }
}

const readDeps = () => ({
    // As the real read does: a stored cache that fails its guard is malformed, never a hit.
    readRows: async (roomId: EphemeraRoomId) => {
        const stored = structuredClone(world.rows.get(roomId))
        const valid = stored !== undefined && isEphemeraLudicCacheData(stored.cache)
        return { version: world.markers.get(roomId) ?? 0, row: valid ? stored : undefined, ...(stored !== undefined && !valid ? { malformed: true } : {}) }
    },
    writeRow: async (row: LudicCacheRow) => {
        const existing = world.rows.get(row.EphemeraId)
        if (existing && existing.builtAtVersion >= row.builtAtVersion) {
            return false
        }
        world.rows.set(row.EphemeraId, structuredClone({ builtAtVersion: row.builtAtVersion, cache: row.cache }))
        return true
    },
    getFreshLudicGraph: freshGraph,
    resolveCanonStack: async () => CANON_STACK,
    clearNameMemos: () => {},
    buildDeps: { getComponentAggregate },
    runSingleFlight: async ({ computation }: any) => computation(),
})

/** The characters row's leaf, held in memory. */
const charactersRowDeps = () => ({
    getRow: async (roomId: EphemeraRoomId) => structuredClone(world.characterRows.get(roomId)) as any,
})

/**
 * The dual-index invariant (bystander separation): a room's characters row names exactly the characters
 * whose own bindings point at the room, each with those binding ids. The character's pointer governs,
 * so this is the row's correctness condition after every change. Room graphs hold no character.
 */
const expectCharactersRowToMatchPointers = async (roomId: EphemeraRoomId) => {
    const present = [...world.graphs.keys()]
        .filter((hostId): hostId is EphemeraCharacterId => isEphemeraCharacterId(hostId))
        .filter((characterId) => bindingIdsInto(world.graphs.get(characterId)!, roomId).length > 0)
        .sort()
    expect([...await readRoomCharacters(roomId, charactersRowDeps())].sort()).toEqual(present)
    for (const characterId of present) {
        expect(world.characterRows.get(roomId)?.[characterId]).toEqual(bindingIdsInto(world.graphs.get(characterId)!, roomId))
    }
    expect([...(world.graphs.get(roomId)?.characterIds ?? [])]).toEqual([])
}

const stored = (roomId: EphemeraRoomId) => readLudicCacheWithOutcome(roomId, readDeps())
const cold = async (roomId: EphemeraRoomId) => (await buildLudicCache(roomId, CANON_STACK, { getLudicGraph: freshGraph, getComponentAggregate })).cache

/** The host a thing sits in now (its first binding's parent), which the kernel's footprint asks for. */
const hostOf = (id: unknown): EphemeraMembershipHostId | undefined => (
    world.graphs.get(id as EphemeraMembershipHostId)?.presenceNodes.map(parentHostOf).find((host) => host !== undefined)
)

const commit = async (steps: MutationKernelStep[], extra: { existenceItems?: any[] } = {}) => {
    const result = await commitStepSequence(
        { steps, ...extra },
        { messageBus: messageBus as any, streamEvent: jest.fn().mockResolvedValue(undefined), getCurrentHost: hostOf as any }
    )
    if (!result.ok) {
        throw new Error(`commit refused: ${result.errorMessage}`)
    }
}

const move = (mover: EphemeraMembershipHostId, name: string, from: ReturnType<typeof ref> | null, to: ReturnType<typeof ref>): MutationKernelStep => (
    { kind: 'movePresenceBinding', hostId: mover, presence: `PRESENCE#${name}` as any, from, to }
)

const receive = (events: any[]) => ephemeraDataSource.receiveEvents?.({
    events,
    streamEvent: jest.fn().mockResolvedValue(undefined),
    streamEnvelope: jest.fn().mockResolvedValue(undefined),
})
const componentUpdated = (component: any) => [{
    header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'ASSET#test-asset', timestamp: 1, type: 'Component Updated' },
    getContent: async () => ({ type: 'Component Updated' as const, component }),
}]
const zoneUpdated = (fromZone: string, toZone: string) => [{
    header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'ASSET#test-asset', timestamp: 1, type: 'Zone Updated' },
    getContent: async () => ({ type: 'Zone Updated' as const, fromZone, toZone }),
}]
/** An authored component's `Component Updated` payload: just enough for the handler to read its id. */
const componentOf = (universalKey: string) => ({ universalKey })

type Case = {
    name: string
    /** Which `MutationKernelStep` kinds this case commits (the completeness guard counts them). */
    kinds?: MutationKernelStep['kind'][]
    world?: () => World
    /** Rooms whose marker must move, and whose cache must equal a cold build afterward. */
    rooms: EphemeraRoomId[]
    /** The change shows in the cache itself, not just the marker (proves the case is not vacuous). */
    changesCache: boolean
    /** A bystander-only change: no room marker moves at all. */
    marksNothing?: boolean
    act: () => Promise<unknown>
}

const cases: Case[] = [
    {
        name: 'a nested object moves out of its container onto the floor',
        kinds: ['movePresenceBinding'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([move(CUP, 'cup1', ref(TABLE, 'PRESENCE#tbl'), remainder(R1))]),
    },
    {
        name: 'a character moves between rooms (a bystander: no room is marked)',
        kinds: ['movePresenceBinding'],
        rooms: [],
        changesCache: false,
        marksNothing: true,
        act: () => commit([move(ALPHA, 'Base', remainder(R1), remainder(R2))]),
    },
    {
        name: 'an object is released from where it sat',
        kinds: ['movePresenceBinding'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([{ kind: 'movePresenceBinding', to: null, hostId: BOX, presence: 'PRESENCE#Base' as any, from: remainder(R1) }]),
    },
    {
        name: 'an object gains a second binding in another room',
        kinds: ['addPresenceBinding'],
        rooms: [R1, R2],
        changesCache: true,
        act: () => commit([{ kind: 'addPresenceBinding', hostId: BOX, fromHostPresence: remainder(R2), presenceUuid: 'box2' }]),
    },
    {
        name: 'a binding is repaired to point at another host',
        kinds: ['repairPresenceBinding'],
        rooms: [R1, R2],
        changesCache: true,
        act: () => commit([{ kind: 'repairPresenceBinding', hostId: BOX, presenceId: 'PRESENCE#Base' as any, fromHostPresence: remainder(R2), previousParent: remainder(R1), cover: remainderCover() }]),
    },
    {
        name: 'a binding with children is renamed to Base',
        kinds: ['renamePresenceBinding'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([{ kind: 'renamePresenceBinding', hostId: TABLE, from: 'PRESENCE#tbl' as any, to: 'PRESENCE#Base' as any, parent: remainder(R1), childHosts: [CUP, SAUCER] }]),
    },
    {
        name: 'a bystander character\'s binding is renamed to Base (no room is marked)',
        kinds: ['renamePresenceBinding'],
        rooms: [],
        changesCache: false,
        marksNothing: true,
        act: () => {
            // Alpha holds an old-shaped binding, and the characters row names it.
            world.graphs.set(ALPHA as any, testLudicGraph(ALPHA as any, { nodes: [hostBinding('alpha-old', R1)] }))
            world.characterRows.set(R1, { [ALPHA]: ['PRESENCE#alpha-old'] })
            return commit([{ kind: 'renamePresenceBinding', hostId: ALPHA, from: 'PRESENCE#alpha-old' as any, to: 'PRESENCE#Base' as any, parent: remainder(R1), childHosts: [] }])
        },
    },
    {
        name: 'an improvised object is created and placed',
        kinds: ['createComponent', 'movePresenceBinding'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([
            { kind: 'createComponent', hostId: MUG, meta: { EphemeraId: MUG, DataCategory: 'Meta::Object' } as any },
            move(MUG, 'Base', null, remainder(R1)),
        ]),
    },
    {
        name: 'an improvised object is released and destroyed',
        kinds: ['movePresenceBinding', 'destroyComponent'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([
            { kind: 'movePresenceBinding', to: null, hostId: BOX, presence: 'PRESENCE#Base' as any, from: remainder(R1) },
            { kind: 'destroyComponent', hostId: BOX },
        ]),
    },
    {
        name: 'part of a binding moves to another room, minting a binding there',
        kinds: ['movePresenceBinding'],
        rooms: [R1, R2],
        changesCache: true,
        act: () => commit([{
            kind: 'movePresenceBinding',
            hostId: TABLE,
            presence: 'PRESENCE#tbl' as any,
            from: remainder(R1),
            to: remainder(R2),
            subCover: [entry(SAUCER, 'PRESENCE#sau1')],
            mintedPresence: 'PRESENCE#tbl2' as any,
        }]),
    },
    {
        name: 'a binding is moved into another binding of the same whole (they join)',
        kinds: ['movePresenceBinding'],
        world: splitTableWorld,
        rooms: [R1],
        changesCache: true,
        act: () => commit([{
            kind: 'movePresenceBinding',
            hostId: TABLE,
            presence: 'PRESENCE#tbl2' as any,
            from: remainder(R1),
            to: remainder(R1),
            cover: { members: [entry(SAUCER, 'PRESENCE#sau1')] },
        }]),
    },
    {
        name: 'a relation is established between two things in a room',
        kinds: ['establishRelation'],
        rooms: [R1],
        changesCache: true,
        act: () => commit([{ kind: 'establishRelation', subjectId: BOX, targetId: TABLE, hostId: R1, relationKind: 'Custom', relationLabel: 'tied to' }]),
    },
    {
        name: 'a relation between two things in a room is dissolved',
        kinds: ['dissolveRelation'],
        world: () => {
            const base = freshWorld()
            base.graphs.set(R1, testLudicGraph(R1, {
                nodes: [{ tag: 'Room', universalKey: R1 }, { tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: BOX }, presenceBindingNode(parentRemainderKey(R1))],
                edges: [{ tag: 'Relational', from: BOX, to: TABLE, kind: 'Custom', relationLabel: 'tied to' }],
            }))
            return base
        },
        rooms: [R1],
        changesCache: true,
        act: () => commit([{ kind: 'dissolveRelation', subjectId: BOX, targetId: TABLE, hostId: R1, relationKind: 'Custom', relationLabel: 'tied to' }]),
    },
    {
        name: 'a crossing port is added to a nested host, then removed',
        kinds: ['addCrossingPort', 'removeCrossingPort'],
        rooms: [R1],
        changesCache: false,
        act: async () => {
            await commit([{ kind: 'addCrossingPort', hostId: TABLE, port: { portId: 'p1', fromHostId: R1, kind: 'Custom', exteriorRelationLabel: 'tied to' } as any }])
            await commit([{ kind: 'removeCrossingPort', hostId: TABLE, portId: 'p1' }])
        },
    },
    {
        name: 'a containment population places an unplaced child in a room',
        rooms: [R1],
        changesCache: true,
        act: () => populateContainmentAtCache(R1, [LAMP], { messageBus: messageBus as any, streamEvent: jest.fn().mockResolvedValue(undefined) }),
    },
    {
        name: 'a structure heal rewrites a host\'s graph',
        rooms: [R1],
        changesCache: false,
        act: () => healLudicGraphStructure(R1, { dryRun: false }, {
            getStoredLudicGraph: async () => {
                const { ports: _ports, ...drifted } = world.graphs.get(R1)!.toStored() as any
                return drifted
            },
        }),
    },
    {
        name: 'the Coyote clear removes a room\'s graph',
        rooms: [R1],
        changesCache: true,
        act: () => persistClearStoredLudicGraphs({
            getGameRooms: async () => ['Cafe'],
            getActiveCharactersInCoyoteRooms: async () => [ALPHA],
        }),
    },
    {
        name: 'a character arrives in the same commit that moves an object in the room (the object marks the room)',
        kinds: ['movePresenceBinding'],
        world: () => {
            const base = freshWorld()
            base.graphs.set(ALPHA as any, testLudicGraph(ALPHA as any, { nodes: [presenceBindingNode('Base')] }))
            base.characterRows.set(R1, {})
            return base
        },
        rooms: [R1],
        changesCache: true,
        act: () => commit([
            move(ALPHA, 'Base', null, remainder(R1)),
            move(CUP, 'cup1', ref(TABLE, 'PRESENCE#tbl'), remainder(R1)),
        ]),
    },
    {
        name: 'a character disconnects (its binding is released from the room)',
        kinds: ['movePresenceBinding'],
        rooms: [],
        changesCache: false,
        marksNothing: true,
        act: () => commit([{ kind: 'movePresenceBinding', to: null, hostId: ALPHA, presence: 'PRESENCE#Base' as any, from: remainder(R1) }]),
    },
    {
        name: 'a character connects (its hostless binding is placed in the room)',
        kinds: ['movePresenceBinding'],
        world: () => {
            const base = freshWorld()
            base.graphs.set(R1, testLudicGraph(R1, {
                nodes: [{ tag: 'Room', universalKey: R1 }, { tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: BOX }, presenceBindingNode(parentRemainderKey(R1))],
            }))
            base.graphs.set(ALPHA as any, testLudicGraph(ALPHA as any, { nodes: [presenceBindingNode('Base')] }))
            base.characterRows.set(R1, {})
            return base
        },
        rooms: [],
        changesCache: false,
        marksNothing: true,
        act: () => commit([move(ALPHA, 'Base', null, remainder(R1))]),
    },
    {
        name: 'an object is renamed',
        rooms: [R1],
        changesCache: true,
        act: async () => {
            world.names[CUP] = 'Teacup'
            await receive(componentUpdated(componentOf(CUP)))
        },
    },
    {
        name: 'a character is renamed',
        rooms: [],
        // the cache holds no character: a rename refreshes rosters on `RoomUpdate` and marks no room
        changesCache: false,
        marksNothing: true,
        act: async () => {
            world.names[ALPHA] = 'Alpha Prime'
            await receive(componentUpdated(componentOf(ALPHA)))
        },
    },
    {
        name: 'a room is renamed or its participating assets change',
        rooms: [R1],
        changesCache: false,
        act: async () => {
            world.names[R1] = 'Bistro'
            await receive(componentUpdated(new StandardRoom(deIndentWML(`<Room uuid=(Cafe)><ShortName>Bistro</ShortName></Room>`))))
        },
    },
    {
        name: 'an asset enters Canon',
        rooms: [R1, R2],
        changesCache: false,
        act: async () => { await receive(zoneUpdated('Library', 'Canon')) },
    },
    {
        name: 'an asset leaves Canon',
        rooms: [R1, R2],
        changesCache: false,
        act: async () => { await receive(zoneUpdated('Canon', 'Library')) },
    },
]

describe('invalidation completeness: a read after any change equals a cold rebuild', () => {
    let logSpy: jest.SpyInstance
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        world = freshWorld()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        jest.mocked(ephemeraDB.transactWrite).mockImplementation(applyTransact as any)
        jest.mocked(ephemeraDB.optimisticUpdate).mockImplementation(applyOptimisticUpdate as any)
        jest.mocked(ephemeraDB.deleteItem).mockImplementation((async ({ EphemeraId, DataCategory }: any) => {
            if (DataCategory === LUDIC_CACHE_CHARACTERS_DATA_CATEGORY) {
                world.characterRows.delete(EphemeraId)
            }
        }) as any)
        // the package's manual mock predates `strictPrimitiveUpdate`
        ;(ephemeraDB as any).strictPrimitiveUpdate = jest.fn(async (args: any) => {
            applyPrimitiveUpdate({ Key: args.Key, UpdateExpression: args.UpdateExpression })
        })
        jest.spyOn(internalCache.Positions, 'getLudicGraph').mockImplementation(((hostId: EphemeraMembershipHostId) => freshGraph(hostId)) as any)
        jest.spyOn(internalCache.Positions, 'set').mockImplementation(() => {})
        jest.spyOn(internalCache.Positions, 'invalidate').mockImplementation(() => {})
        jest.spyOn(internalCache.Positions, 'setMembershipContainers').mockImplementation(() => {})
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'invalidate').mockImplementation(() => {})
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'invalidate').mockImplementation(() => {})
        jest.spyOn(internalCache.AssetRooms, 'get').mockImplementation((async (assetId: string) => ({ EphemeraId: assetId, rooms: world.assetRooms[assetId] ?? [] })) as any)
    })

    afterEach(() => {
        logSpy.mockRestore()
        errorSpy.mockRestore()
        jest.restoreAllMocks()
    })

    it.each(cases.map((testCase) => [testCase.name, testCase] as const))('%s', async (_name, testCase) => {
        if (testCase.world) {
            world = testCase.world()
        }
        // Prime every room's row, so the read after the change is a hit unless the change marked it.
        const before = new Map<EphemeraRoomId, LudicCacheRow['cache']>()
        for (const roomId of [R1, R2]) {
            before.set(roomId, (await stored(roomId)).cache)
        }
        expect((await stored(R1)).outcome).toBe('hit')
        const markersBefore = new Map(world.markers)

        await testCase.act()

        for (const roomId of testCase.rooms) {
            expect(world.markers.get(roomId) ?? 0).toBeGreaterThan(markersBefore.get(roomId) ?? 0)
        }
        if (testCase.marksNothing) {
            expect(world.markers).toEqual(markersBefore)
        }
        for (const roomId of [R1, R2]) {
            const read = await stored(roomId)
            expect(read.cache).toEqual(await cold(roomId))
            if (testCase.rooms.includes(roomId)) {
                expect(read.outcome).toBe<LudicCacheReadOutcome>('stale')
                if (testCase.changesCache && roomId === testCase.rooms[0]) {
                    expect(read.cache).not.toEqual(before.get(roomId))
                }
            }
            await expectCharactersRowToMatchPointers(roomId)
        }
    })

    it('a read with no change in between is a hit (the cases are not passing by always rebuilding)', async () => {
        await stored(R1)
        expect((await stored(R1)).outcome).toBe('hit')
    })

    it('a commit confined to a character\'s inventory marks no room', async () => {
        // Alpha carries a pouch and a hat; the hat goes into the pouch. Both sit under Alpha, a
        // character-hosted shard, which a room's cache never recurses into, so no room is stale.
        const POUCH = 'OBJECT#Pouch' as EphemeraObjectId
        const HAT = 'OBJECT#Hat' as EphemeraObjectId
        world.names[POUCH] = 'Pouch'
        world.names[HAT] = 'Hat'
        world.graphs.set(ALPHA as any, testLudicGraph(ALPHA as any, {
            nodes: [{ tag: 'Object', universalKey: POUCH }, { tag: 'Object', universalKey: HAT }, hostBinding('Base', R1, [entry(POUCH, 'PRESENCE#pch1'), entry(HAT, 'PRESENCE#hat1'), { tag: 'Remainder' }])],
        }))
        world.graphs.set(POUCH, testLudicGraph(POUCH, { nodes: [{ tag: 'Object', universalKey: POUCH }, hostBinding('pch1', ref(ALPHA as any, 'PRESENCE#Base'))] }))
        world.graphs.set(HAT, testLudicGraph(HAT, { nodes: [{ tag: 'Object', universalKey: HAT }, hostBinding('hat1', ref(ALPHA as any, 'PRESENCE#Base'))] }))
        await stored(R1)
        const before = world.markers.get(R1) ?? 0
        await commit([move(HAT, 'hat1', ref(ALPHA as any, 'PRESENCE#Base'), ref(POUCH, 'PRESENCE#pch1'))])
        expect(world.markers.get(R1) ?? 0).toBe(before)
        const read = await stored(R1)
        expect(read.outcome).toBe('hit')
        expect(read.cache).toEqual(await cold(R1))
        // neither the character (a bystander is in the characters row, not the cache) nor what it carries is in the room's cache
        const held = read.cache.nodes.map(({ universalKey }) => universalKey)
        expect(held).not.toContain(ALPHA)
        expect(held).not.toContain(POUCH)
        expect(held).not.toContain(HAT)
    })

    it('an object handed from one character to another in the same room marks no room', async () => {
        const BETA = 'CHARACTER#Beta' as EphemeraCharacterId
        const POUCH = 'OBJECT#Pouch' as EphemeraObjectId
        world.names[POUCH] = 'Pouch'
        world.names[BETA] = 'Beta'
        world.graphs.set(R1, testLudicGraph(R1, {
            nodes: [{ tag: 'Room', universalKey: R1 }, { tag: 'Object', universalKey: TABLE }, { tag: 'Object', universalKey: BOX }, presenceBindingNode(parentRemainderKey(R1))],
        }))
        world.graphs.set(ALPHA as any, testLudicGraph(ALPHA as any, { nodes: [{ tag: 'Object', universalKey: POUCH }, hostBinding('Base', R1, [entry(POUCH, 'PRESENCE#pch1')])] }))
        world.graphs.set(BETA as any, testLudicGraph(BETA as any, { nodes: [hostBinding('beta1', R1)] }))
        world.graphs.set(POUCH, testLudicGraph(POUCH, { nodes: [{ tag: 'Object', universalKey: POUCH }, hostBinding('pch1', ref(ALPHA as any, 'PRESENCE#Base'))] }))
        await stored(R1)
        const before = world.markers.get(R1) ?? 0
        await commit([move(POUCH, 'pch1', ref(ALPHA as any, 'PRESENCE#Base'), ref(BETA as any, 'PRESENCE#beta1'))])
        expect(world.markers.get(R1) ?? 0).toBe(before)
        const read = await stored(R1)
        expect(read.outcome).toBe('hit')
        expect(read.cache).toEqual(await cold(R1))
    })

    it('exercises every structural step kind (a new kind without a case here fails)', () => {
        const exercised = new Set(cases.flatMap((testCase) => testCase.kinds ?? []))
        // `capture` only reads, so it writes nothing to mark.
        const writing = (Object.keys(mutationKernelStepKinds) as MutationKernelStep['kind'][]).filter((kind) => kind !== 'capture')
        expect(writing.filter((kind) => !exercised.has(kind))).toEqual([])
    })
})
