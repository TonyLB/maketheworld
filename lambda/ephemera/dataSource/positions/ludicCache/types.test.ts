import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import {
    isEphemeraLudicCacheCrossing,
    isEphemeraLudicCacheData,
    isEphemeraLudicCacheEdge,
    isEphemeraLudicCacheNode,
} from './types'

const validCrossing = { edgeText: 'through the doorway', into: 'ROOM#Other' }

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
            homeShards: ['ROOM#Test'],
            interiorConsolidated: false,
        })).toBe(true)
    })

    it('accepts a room node carrying an embedding', () => {
        const embedding = makeEmbedding()
        expect(isEphemeraLudicCacheNode({
            tag: 'Room',
            universalKey: 'ROOM#Test',
            shortName: 'a room',
            homeShards: ['ROOM#Test'],
            embedding,
            interiorConsolidated: true,
        })).toBe(true)
    })

    it('rejects a node whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Bogus',
            universalKey: 'FEATURE#Test',
            shortName: 'a feature',
            homeShards: ['ROOM#Test'],
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('rejects a missing shortName', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            homeShards: ['ROOM#Test'],
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('accepts a multi-hosted node present in several shards', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#string',
            shortName: 'a string',
            homeShards: ['ROOM#Room', 'CHARACTER#Alpha'],
            interiorConsolidated: false,
        })).toBe(true)
    })

    it('rejects a scalar homeShards', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            homeShards: 'ROOM#Test',
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('accepts a homeShards entry that is an object or feature host id (LP0 widened EphemeraMembershipHostId)', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            homeShards: ['ROOM#Test', 'OBJECT#Box', 'FEATURE#Wall'],
            interiorConsolidated: false,
        })).toBe(true)
    })

    it('rejects a homeShards entry that is not a membership host id', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            homeShards: ['ROOM#Test', 'KNOWLEDGE#helmet'],
            interiorConsolidated: false,
        })).toBe(false)
    })

    it('rejects a non-boolean interiorConsolidated', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            homeShards: ['ROOM#Test'],
            interiorConsolidated: undefined,
        })).toBe(false)
    })

    it('rejects an embedding that is not a SemanticEmbedding', () => {
        expect(isEphemeraLudicCacheNode({
            tag: 'Object',
            universalKey: 'OBJECT#helmet',
            shortName: 'a helmet',
            homeShards: ['ROOM#Test'],
            embedding: { vector: [0, 1, 0] },
            interiorConsolidated: false,
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheCrossing', () => {
    it('accepts a well-formed crossing', () => {
        expect(isEphemeraLudicCacheCrossing(validCrossing)).toBe(true)
    })

    it('rejects an into that is not a membership host id', () => {
        expect(isEphemeraLudicCacheCrossing({ edgeText: 'through the rope', into: 'not-an-id' })).toBe(false)
    })
})

describe('isEphemeraLudicCacheEdge', () => {
    it('accepts an edge with empty crossings', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
            crossings: [],
        })).toBe(true)
    })

    it('accepts an edge with populated crossings', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#ropeEnd',
            kind: 'Custom',
            relationLabel: 'TiedTo',
            crossings: [validCrossing],
        })).toBe(true)
    })

    it('rejects an edge with missing crossings', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'On',
        })).toBe(false)
    })

    it('rejects an edge whose base shape is invalid', () => {
        expect(isEphemeraLudicCacheEdge({
            tag: 'Relational',
            from: 'OBJECT#boulder',
            to: 'OBJECT#rope',
            kind: 'NotAKind',
            crossings: [],
        })).toBe(false)
    })
})

describe('isEphemeraLudicCacheData', () => {
    const validNode = {
        tag: 'Object' as const,
        universalKey: 'OBJECT#helmet',
        shortName: 'a helmet',
        homeShards: ['ROOM#Test'],
        interiorConsolidated: false,
    }
    const validEdge = {
        tag: 'Relational' as const,
        from: 'OBJECT#boulder',
        to: 'OBJECT#rope',
        kind: 'On' as const,
        crossings: [],
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

    it('accepts an object or feature hostId (LP0 widened EphemeraMembershipHostId)', () => {
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
