import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    addCharacterToGraph,
    characterNode,
    graphCharacterIds,
    removeCharacterFromGraph,
    seedGraphFromActiveCharacters,
} from './positionGraphMerge'

const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const CHARACTER_B = 'CHARACTER#Beta' as EphemeraCharacterId

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
})
