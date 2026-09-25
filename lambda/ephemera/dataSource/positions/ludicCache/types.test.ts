import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    isEphemeraLudicCacheData,
    isEphemeraLudicCacheEdge,
    isEphemeraLudicCacheNode,
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
        })).toBe(true)
    })

    it('accepts a room node carrying an embedding', () => {
        const embedding = makeEmbedding()
        expect(isEphemeraLudicCacheNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
            shortName: 'a room',
            embedding,
        })).toBe(true)
    })

    it('rejects a node whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Bogus',
            universalKey: 'FEATURE#Test',
            shortName: 'a feature',
        })).toBe(false)
    })

    it('accepts a missing shortName (unresolved)', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
        })).toBe(true)
    })

    it('rejects a non-string shortName', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 12,
        })).toBe(false)
    })

    it('rejects an embedding that is not a SemanticEmbedding', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            embedding: { vector: [0, 1, 0] },
        })).toBe(false)
    })

    // Structure arm (PN-19, presenceNodes Slice 3): a presence node carries none of the cache
    // extras a component node needs --- no shortName --- but does carry
    // `cover` (narrowed to the `'Enumerated'` arm only, `'Full'` being unrepresentable in the
    // cache by construction) and `consolidated` (PN-15, a separate boolean beside `cover`).
    it('accepts a presence node with an Enumerated cover and a consolidated flag', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [] },
            consolidated: false,
        })).toBe(true)
    })

    it("rejects a presence node with a 'Full' cover -- unrepresentable in the cache by construction (PN-19)", () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Full' },
            consolidated: false,
        })).toBe(false)
    })

    it('rejects a presence node missing consolidated', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
            cover: { tag: 'Enumerated', members: [] },
        })).toBe(false)
    })

    it('rejects a presence node with a malformed fromHostId', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'PRESENCE#xyz789',
            cover: { tag: 'Enumerated', members: [] },
            consolidated: false,
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
            supportedBy: [[{ presenceBucketIds: ['PRESENCE#other'], port: 'port_1' }]],
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
                [{ presenceBucketIds: ['PRESENCE#other'], port: 'port_1' }],
                [
                    { presenceBucketIds: ['PRESENCE#alternate', 'PRESENCE#alternate2'], port: 'port_2' },
                    { presenceBucketIds: ['PRESENCE#other'], port: 'port_3' },
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
            supportedBy: [[{ presenceBucketIds: ['not-an-id'], port: 'port_1' }]],
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
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet', shortName: 12 }],
            edges: [],
        })).toBe(false)
    })

    // Referential integrity (rebuild 3d, presenceNodes Slice 6/PN-12): a `cover` entry naming a
    // component node absent from this cache's own `nodes` is internal inconsistency.
    it('rejects a cover entry naming a node absent from nodes', () => {
        const presenceNode = {
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#Test',
            cover: {
                tag: 'Enumerated' as const,
                members: [{ host: 'OBJECT#missing', presence: 'PRESENCE#child' }],
            },
            consolidated: true,
        }
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [presenceNode],
            edges: [],
        })).toBe(false)
    })

    it('accepts a cover entry naming a node present in nodes', () => {
        const presenceNode = {
            tag: 'Presence' as const,
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#Test',
            cover: {
                tag: 'Enumerated' as const,
                members: [{ host: 'OBJECT#helmet', presence: 'PRESENCE#child' }],
            },
            consolidated: true,
        }
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [presenceNode, validNode],
            edges: [],
        })).toBe(true)
    })

    // The opposite verdict, and PN-12's instruction is to write it as an explicit test rather
    // than as an absence of one: an edge to an unmaterialized presence node is the *binding
    // exists and was not pulled* signal (PR-15), not corruption, and must PASS.
    it('accepts an edge terminating at an absent presence node', () => {
        expect(isEphemeraLudicCacheData({
            hostId: 'ROOM#Test',
            nodes: [validNode],
            edges: [{
                ...validEdge,
                to: 'PRESENCE#not-pulled',
            }],
        })).toBe(true)
    })
})
