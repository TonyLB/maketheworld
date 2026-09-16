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
            interiorConsolidated: false,
        })).toBe(true)
    })

    it('accepts a room node carrying an embedding', () => {
        const embedding = makeEmbedding()
        expect(isEphemeraLudicCacheNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
            shortName: 'a room',
            embedding,
            interiorConsolidated: true,
        })).toBe(true)
    })

    it('rejects a node whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Bogus',
            universalKey: 'FEATURE#Test',
            shortName: 'a feature',
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('rejects a missing shortName', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('rejects a non-boolean interiorConsolidated', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            interiorConsolidated: undefined,
        })).toBe(false)
    })

    it('rejects an embedding that is not a SemanticEmbedding', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            embedding: { vector: [0, 1, 0] },
            interiorConsolidated: false,
        })).toBe(false)
    })

    // Structure arm (PN-5, presenceNodes Slice 2): a presence node carries none of the cache
    // extras a component node needs --- no shortName, no interiorConsolidated. `consolidated`
    // is not added here; that lands with PN-7 in presenceNodes Slice 4.
    it('accepts a bare presence node with no shortName or interiorConsolidated', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'ROOM#A',
        })).toBe(true)
    })

    it('rejects a presence node with a malformed fromHostId', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Presence',
            universalKey: 'PRESENCE#abc123',
            fromHostId: 'PRESENCE#xyz789',
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheEdge', () => {
    it('accepts an edge with empty chains', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
            chains: [],
        })).toBe(true)
    })

    it('accepts an edge with populated chains', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#ropeEnd',
            kind: 'Custom',
            relationLabel: 'TiedTo',
            chains: [['ROOM#Other']],
        })).toBe(true)
    })

    it('accepts an edge with more than one independently-consolidated chain', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#ropeEnd',
            kind: 'Custom',
            relationLabel: 'TiedTo',
            chains: [['ROOM#Other'], ['ROOM#Alternate', 'ROOM#Other']],
        })).toBe(true)
    })

    it('rejects an edge with missing chains', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
        })).toBe(false)
    })

    it('rejects an edge whose chains hop is not a membership host id', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
            chains: [['not-an-id']],
        })).toBe(false)
    })

    it('rejects an edge whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'NotAKind',
            chains: [],
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheData', () => {
    const validNode = {
        tag: 'Object' as const,
        universalKey: 'OBJECT#helmet',
        shortName: 'a helmet',
        interiorConsolidated: false,
    }
    const validEdge = {
        tag: 'Relational' as const,
        from: 'OBJECT#boulder',
        to: 'OBJECT#rope',
        kind: 'On' as const,
        chains: [],
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
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet' }],
            edges: [],
        })).toBe(false)
    })
})
