import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    addCharacterToGraph,
    addObjectToGraph,
    characterNode,
    graphCharacterIds,
    graphObjectIds,
    objectNode,
    playPositionGraphToStoredTopology,
    removeCharacterFromGraph,
    removeObjectFromGraph,
    seedGraphFromActiveCharacters,
} from './positionGraphMerge'

const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const CHARACTER_B = 'CHARACTER#Beta' as EphemeraCharacterId
const OBJECT_A = 'OBJECT#Skates' as EphemeraObjectId

describe('positionGraphMerge', () => {
    it('characterNode returns Character tag with universalKey', () => {
        expect(characterNode(CHARACTER_A)).toEqual({
            tag: 'Character',
            universalKey: CHARACTER_A,
        })
    })

    it('seedGraphFromActiveCharacters maps roster to nodes', () => {
        const graph = seedGraphFromActiveCharacters([
            { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
            { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
        ])
        expect(graph.nodes).toEqual([
            characterNode(CHARACTER_A),
            characterNode(CHARACTER_B),
        ])
        expect(graph.edges).toEqual([])
    })

    it('seedGraphFromActiveCharacters returns empty graph for empty roster', () => {
        expect(seedGraphFromActiveCharacters([])).toEqual({ nodes: [], edges: [] })
    })

    it('removeCharacterFromGraph removes matching node', () => {
        const graph = seedGraphFromActiveCharacters([
            { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
            { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
        ])
        expect(removeCharacterFromGraph(graph, CHARACTER_A).nodes).toEqual([characterNode(CHARACTER_B)])
    })

    it('addCharacterToGraph appends new node', () => {
        const graph = seedGraphFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }])
        expect(addCharacterToGraph(graph, CHARACTER_B).nodes).toEqual([
            characterNode(CHARACTER_A),
            characterNode(CHARACTER_B),
        ])
    })

    it('addCharacterToGraph is idempotent when character already present', () => {
        const graph = seedGraphFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }])
        expect(addCharacterToGraph(graph, CHARACTER_A)).toBe(graph)
    })

    it('graphCharacterIds returns set of universal keys', () => {
        const graph = seedGraphFromActiveCharacters([
            { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
            { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
        ])
        expect(graphCharacterIds(graph)).toEqual(new Set([CHARACTER_A, CHARACTER_B]))
    })

    it('objectNode returns Object tag with universalKey', () => {
        expect(objectNode(OBJECT_A)).toEqual({
            tag: 'Object',
            universalKey: OBJECT_A,
        })
    })

    it('addObjectToGraph appends new node and preserves characters', () => {
        const graph = seedGraphFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }])
        expect(addObjectToGraph(graph, OBJECT_A).nodes).toEqual([
            characterNode(CHARACTER_A),
            objectNode(OBJECT_A),
        ])
    })

    it('addObjectToGraph is idempotent when object already present', () => {
        const graph = { nodes: [objectNode(OBJECT_A)], edges: [] as [] }
        expect(addObjectToGraph(graph, OBJECT_A)).toBe(graph)
    })

    it('removeObjectFromGraph removes matching node only', () => {
        const graph = {
            nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
            edges: [] as [],
        }
        expect(removeObjectFromGraph(graph, OBJECT_A).nodes).toEqual([characterNode(CHARACTER_A)])
    })

    it('graphObjectIds returns set of object universal keys', () => {
        const graph = { nodes: [objectNode(OBJECT_A)], edges: [] as [] }
        expect(graphObjectIds(graph)).toEqual(new Set([OBJECT_A]))
    })

    it('playPositionGraphToStoredTopology preserves character and object nodes', () => {
        expect(playPositionGraphToStoredTopology({
            nodes: [
                { tag: 'Character', universalKey: CHARACTER_A },
                { tag: 'Object', universalKey: OBJECT_A },
            ],
            edges: [],
        })).toEqual({
            nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
        })
    })
})
