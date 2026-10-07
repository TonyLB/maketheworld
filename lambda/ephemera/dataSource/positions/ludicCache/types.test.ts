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
                fromHostId: 'ROOM#A',
                cover: { tag: 'Enumerated', members: [] },
                consolidated: true,
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
                fromHostId: 'ROOM#A',
                cover: { tag: 'Full' },
                consolidated: true,
            }],
        })).toBe(false)
    })

    // A binding nests on its owner; it is never a node in its own right.
    it('rejects a binding standing alone as a node', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [] },
            consolidated: false,
        })).toBe(false)
    })
})

// Structure arm (PN-19, presenceNodes Slice 3): a binding carries none of the cache extras a
// component node needs --- no shortName --- but does carry `cover` (narrowed to the `'Enumerated'`
// arm only, `'Full'` being unrepresentable in the cache by construction) and `consolidated`
// (PN-15, a separate boolean beside `cover`).
describe('isEphemeraLudicCachePresenceNode', () => {
    it('accepts a binding with an Enumerated cover and a consolidated flag', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [] },
            consolidated: false,
        })).toBe(true)
    })

    it("rejects a binding with a 'Full' cover -- unrepresentable in the cache by construction (PN-19)", () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Full' },
            consolidated: false,
        })).toBe(false)
    })

    it('rejects a binding missing consolidated', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [] },
        })).toBe(false)
    })

    it('rejects a binding with a malformed fromHostId', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'PRESENCE#xyz789',
            cover: { tag: 'Enumerated', members: [] },
            consolidated: false,
        })).toBe(false)
    })

    // A cache cover entry's `presence` is optional (PNR-3): a member expanded from a graph-side
    // 'Full' cover whose own binding the fold could not find is still covered.
    it('accepts cover entries with and without the member\'s own binding', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [{ host: 'OBJECT#Z', presence: 'PRESENCE#z_in_x' }, { host: 'OBJECT#W' }] },
            consolidated: true,
        })).toBe(true)
    })

    it('rejects a cover entry whose presence is not a presence id', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [{ host: 'OBJECT#Z', presence: 'OBJECT#Z' }] },
            consolidated: true,
        })).toBe(false)
    })

    it('rejects a cover entry whose host is not a membership host', () => {
        expect(isEphemeraLudicCachePresenceNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [{ host: 'PRESENCE#z_in_x' }] },
            consolidated: true,
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheEdge', () => {
    it('accepts an edge with an empty supportedBy', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
            supportedBy: [],
        })).toBe(true)
    })

    it('accepts an edge with one populated route', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#ropeEnd',
            kind: 'Custom',
            relationLabel: 'TiedTo',
            supportedBy: [[{ host: 'OBJECT#box', presenceBucketIds: ['PRESENCE#other'], port: 'port_1' }]],
        })).toBe(true)
    })

    it('accepts an edge with more than one independently-consolidated route, and a hop with more than one alternative binding', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#ropeEnd',
            kind: 'Custom',
            relationLabel: 'TiedTo',
            supportedBy: [
                [{ host: 'OBJECT#box', presenceBucketIds: ['PRESENCE#other'], port: 'port_1' }],
                [
                    { host: 'OBJECT#box', presenceBucketIds: ['PRESENCE#alternate', 'PRESENCE#alternate2'], port: 'port_2' },
                    { host: 'OBJECT#crate', presenceBucketIds: ['PRESENCE#other'], port: 'port_3' },
                ],
            ],
        })).toBe(true)
    })

    it('rejects an edge with missing supportedBy', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
        })).toBe(false)
    })

    it('rejects an edge whose hop names a presenceBucketId that is not a presence node id', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
            supportedBy: [[{ host: 'OBJECT#box', presenceBucketIds: ['not-an-id'], port: 'port_1' }]],
        })).toBe(false)
    })

    it('rejects an edge whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'NotAKind',
            supportedBy: [],
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
        supportedBy: [],
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
            fromHostId: 'ROOM#Test',
            cover: { tag: 'Enumerated' as const, members },
            consolidated: true,
        }],
    })
    const helmetBoundIntoBox = {
        ...validNode,
        presenceNodes: [{
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#helmet_in_box',
            fromHostId: 'OBJECT#box',
            cover: { tag: 'Enumerated' as const, members: [] },
            consolidated: true,
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
