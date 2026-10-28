import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    isEphemeraLudicCacheData,
    isEphemeraLudicCacheEdge,
    isEphemeraLudicCacheNode,
    isEphemeraLudicCachePresenceNode,
} from './types'
import { parentRemainderKey } from '../ludicGraph/testFixtures'

const makeEmbedding = (): SemanticEmbedding =>
    SemanticEmbedding.fromFloat32(
        Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0),
        { modelId: 'test-model' }
    )

describe('isEphemeraLudicCacheNode', () => {
    it('accepts a minimal object node', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            presenceNodes: [],
        })).toBe(true)
    })

    it('accepts a room node carrying an embedding', () => {
        const embedding = makeEmbedding()
        expect(isEphemeraLudicCacheNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
            shortName: 'a room',
            embedding,
            presenceNodes: [],
        })).toBe(true)
    })

    it('rejects a node carrying hostingKind (per-host, so ambiguous in a cache; HK-4)', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            hostingKind: 'On',
            presenceNodes: [],
        })).toBe(false)
    })

    it('rejects a node whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Bogus',
            universalKey: 'FEATURE#Test',
            shortName: 'a feature',
            presenceNodes: [],
        })).toBe(false)
    })

    it('accepts a missing shortName (unresolved)', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            presenceNodes: [],
        })).toBe(true)
    })

    it('rejects a non-string shortName', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 12,
            presenceNodes: [],
        })).toBe(false)
    })

    it('rejects an embedding that is not a SemanticEmbedding', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            embedding: { vector: [0, 1, 0] },
            presenceNodes: [],
        })).toBe(false)
    })

    // PNR-1: required, `[]` when the host has none --- never absent.
    it('rejects a node missing presenceNodes', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
        })).toBe(false)
    })

    it('accepts a node carrying its own bindings', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            presenceNodes: [{
                tag: 'Presence',
                universalKey: 'PRESENCE#abc123',
                fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
                cover: { members: [] },
            }],
        })).toBe(true)
    })

    it('rejects a node carrying a malformed binding', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            presenceNodes: [{
                tag: 'Presence',
                universalKey: 'PRESENCE#abc123',
                fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
                cover: { members: [{ tag: 'Remainder' }] },
            }],
        })).toBe(false)
    })

    // A binding nests on its owner; it is never a node in its own right.
    it('rejects a binding standing alone as a node', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [] },
        })).toBe(false)
    })
})

// Structure arm (PN-19, presenceNodes Slice 3): a binding carries none of the cache extras a
// component node needs --- no shortName --- but does carry `cover` (entries only, the
// graph's `Remainder` sentinel being unrepresentable in the cache by construction).
describe('isEphemeraLudicCachePresenceNode', () => {
    it('accepts a binding with an entries-only cover', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [] },
        })).toBe(true)
    })

    it("rejects a binding with a legacy 'Full' cover or a Remainder entry -- unrepresentable in the cache by construction (PN-19)", () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { tag: 'Full' },
        })).toBe(false)
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [{ tag: 'Remainder' }] },
        })).toBe(false)
    })

    it('rejects a binding with a malformed parent pointer', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'PRESENCE#xyz789', presence: 'PRESENCE#abc123' }],
            cover: { members: [] },
        })).toBe(false)
    })

    // A cache cover entry's `presence` is optional (PNR-3): a member expanded from a graph-side
    // 'Full' cover whose own binding the fold could not find is still covered.
    it('accepts cover entries with and without the member\'s own binding', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [{ host: 'OBJECT#Z', presence: 'PRESENCE#z_in_x' }, { host: 'OBJECT#W' }] },
        })).toBe(true)
    })

    it('rejects a cover entry whose presence is not a presence id', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [{ host: 'OBJECT#Z', presence: 'OBJECT#Z' }] },
        })).toBe(false)
    })

    it('rejects a cover entry whose host is not a membership host', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostPresences: [{ host: 'ROOM#A', presence: parentRemainderKey('ROOM#A') }],
            cover: { members: [{ host: 'PRESENCE#z_in_x' }] },
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheEdge', () => {
    it('accepts a plain relational edge', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
        })).toBe(true)
    })

    it('rejects an edge whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'NotAKind',
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheData', () => {
    const validNode = {
        tag: 'Object' as const,
        universalKey: 'OBJECT#helmet',
        shortName: 'a helmet',
        presenceNodes: [],
    }
    const validEdge = {
        tag: 'Relational' as const,
        from: 'OBJECT#boulder',
        to: 'OBJECT#rope',
        kind: 'On' as const,
    }

    it('accepts a well-formed cache', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [validNode],
            edges: [validEdge],
        })).toBe(true)
    })

    it('accepts an empty cache', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [],
            edges: [],
        })).toBe(true)
    })

    it('accepts an object or feature hostId', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'OBJECT#Box',
            nodes: [],
            edges: [],
        })).toBe(true)
        expect(isEphemeraLudicCacheData({
            hostId: 'FEATURE#Wall',
            nodes: [],
            edges: [],
        })).toBe(true)
    })

    it('rejects a hostId that is not a membership host id', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'KNOWLEDGE#helmet',
            nodes: [],
            edges: [],
        })).toBe(false)
    })

    it('rejects missing edges', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [],
        })).toBe(false)
    })

    it('rejects an invalid node in nodes', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet', shortName: 12, presenceNodes: [] }],
            edges: [],
        })).toBe(false)
    })

    // Referential integrity (rebuild 3d, presenceNodes Slice 6/PN-12): a `cover` entry resolves
    // by path --- the host's node, then that binding on it --- and a broken step is internal
    // inconsistency.
    const boxBoundIntoRoom = (members: { host: string, presence?: string }[]) => ({
        tag: 'Object' as const,
        universalKey: 'OBJECT#box',
        presenceNodes: [{
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#box_in_room',
            fromHostPresences: [{ host: 'ROOM#Test', presence: parentRemainderKey('ROOM#Test') }],
            cover: { members },
        }],
    })
    const helmetBoundIntoBox = {
        ...validNode,
        presenceNodes: [{
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#helmet_in_box',
            fromHostPresences: [{ host: 'OBJECT#box', presence: parentRemainderKey('OBJECT#box') }],
            cover: { members: [] },
        }],
    }

    it('rejects a cover entry naming a node absent from nodes', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'OBJECT#missing', presence: 'PRESENCE#child' }])],
            edges: [],
        })).toBe(false)
    })

    it('rejects a cover entry naming a binding its host\'s node does not hold', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'OBJECT#helmet', presence: 'PRESENCE#elsewhere' }]), helmetBoundIntoBox],
            edges: [],
        })).toBe(false)
    })

    it('accepts a cover entry that resolves to its host\'s own binding', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'OBJECT#helmet', presence: 'PRESENCE#helmet_in_box' }]), helmetBoundIntoBox],
            edges: [],
        })).toBe(true)
    })

    // PNR-3: the fold could not find which binding; the host step still resolves.
    it('accepts a cover entry without a binding when its host is present', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'OBJECT#helmet' }]), validNode],
            edges: [],
        })).toBe(true)
    })

    // A present character is in the cache as a leaf node (its bindings, none of its inventory), so a room's cover
    // entry for it resolves like any other. The guard once exempted a host-only character entry that had no node;
    // that shape is rejected again.
    const characterLeaf = {
        tag: 'Character' as const,
        universalKey: 'CHARACTER#alpha',
        presenceNodes: [{
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#alpha1',
            fromHostPresences: [{ host: 'ROOM#Test', presence: parentRemainderKey('ROOM#Test') }],
            cover: { members: [] },
        }],
    }

    it('rejects a cover entry naming a character the cache holds no node for', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'CHARACTER#alpha' }])],
            edges: [],
        })).toBe(false)
    })

    it('accepts a cover entry naming a present character\'s binding when the cache holds its leaf node', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'CHARACTER#alpha', presence: 'PRESENCE#alpha1' }]), characterLeaf],
            edges: [],
        })).toBe(true)
    })

    it('rejects a cover entry without a binding when its host is absent', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [boxBoundIntoRoom([{ host: 'OBJECT#missing' }])],
            edges: [],
        })).toBe(false)
    })

    // The opposite verdict, and PN-12's instruction is to write it as an explicit test rather
    // than as an absence of one: an edge to an unmaterialized presence node is the *binding
    // exists and was not pulled* signal (PR-15), not corruption, and must PASS.
    // Slice 3 (PNR-2(a)): a bare `PRESENCE#` terminal is illegal in the cache now --- even an
    // absent binding's reference must carry its owner, the exterior form `{ owner, port }`.
    it('accepts an edge terminating at an absent presence node', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [validNode],
            edges: [{
                ...validEdge,
                to: { owner: 'OBJECT#helmet', port: 'PRESENCE#not-pulled' },
            }],
        })).toBe(true)
    })

    it('rejects an edge terminating at a bare presence terminal', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [validNode],
            edges: [{
                ...validEdge,
                to: 'PRESENCE#not-pulled',
            }],
        })).toBe(false)
    })
})
