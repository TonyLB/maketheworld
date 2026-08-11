import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import {
    edgesMatch,
    EphemeraLudicGraph,
    RelationalEdgeStillReferencedError,
    characterNode,
    fromCharacterMeta,
    fromRoomMeta,
    objectNode,
    seedFromActiveCharacters,
    toStoredRelationalEdge,
} from './index'
import { extractRelationalEdgesFromStored } from './baseClasses'

const HOST_ID = 'ROOM#Test' as EphemeraRoomId
const OTHER_HOST_ID = 'ROOM#Other' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const CHARACTER_B = 'CHARACTER#Beta' as EphemeraCharacterId
const OBJECT_A = 'OBJECT#Skates' as EphemeraObjectId
const OBJECT_B = 'OBJECT#Table' as EphemeraObjectId
const OBJECT_C = 'OBJECT#Chair' as EphemeraObjectId

describe('EphemeraLudicGraph', () => {
    describe('node builders', () => {
        it('characterNode returns Character tag with universalKey', () => {
            expect(characterNode(CHARACTER_A)).toEqual({
                tag: 'Character',
                universalKey: CHARACTER_A,
            })
        })

        it('objectNode returns Object tag with universalKey', () => {
            expect(objectNode(OBJECT_A)).toEqual({
                tag: 'Object',
                universalKey: OBJECT_A,
            })
        })
    })

    describe('seedFromActiveCharacters', () => {
        it('maps roster to nodes', () => {
            const graph = seedFromActiveCharacters([
                { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
                { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
            ], HOST_ID)
            expect(graph.toStored()).toEqual({
                nodes: [characterNode(CHARACTER_A), characterNode(CHARACTER_B)],
                edges: [],
            })
        })

        it('returns empty graph for empty roster', () => {
            expect(seedFromActiveCharacters([], HOST_ID).toStored()).toEqual({ nodes: [], edges: [] })
        })
    })

    describe('membership nodes', () => {
        it('addCharacter appends new node', () => {
            const graph = seedFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }], HOST_ID)
            expect(graph.addCharacter(CHARACTER_B).toStored().nodes).toEqual([
                characterNode(CHARACTER_A),
                characterNode(CHARACTER_B),
            ])
        })

        it('addCharacter is idempotent when character already present', () => {
            const graph = seedFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }], HOST_ID)
            expect(graph.addCharacter(CHARACTER_A)).toBe(graph)
        })

        it('characterIds returns set of universal keys', () => {
            const graph = seedFromActiveCharacters([
                { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
                { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
            ], HOST_ID)
            expect(graph.characterIds).toEqual(new Set([CHARACTER_A, CHARACTER_B]))
        })

        it('addObject appends new node and preserves characters', () => {
            const graph = seedFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }], HOST_ID)
            expect(graph.addObject(OBJECT_A).toStored().nodes).toEqual([
                characterNode(CHARACTER_A),
                objectNode(OBJECT_A),
            ])
        })

        it('addObject is idempotent when object already present', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { nodes: [objectNode(OBJECT_A)], edges: [] })
            expect(graph.addObject(OBJECT_A)).toBe(graph)
        })

        it('objectIds returns set of object universal keys', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { nodes: [objectNode(OBJECT_A)], edges: [] })
            expect(graph.objectIds).toEqual(new Set([OBJECT_A]))
        })
    })

    describe('removeObject (BD-33/BD-35 assert-and-throw)', () => {
        it('throws RelationalEdgeStillReferencedError when a relational edge still references the object', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            expect(() => graph.removeObject(OBJECT_A)).toThrow(RelationalEdgeStillReferencedError)
            try {
                graph.removeObject(OBJECT_A)
                throw new Error('expected removeObject to throw')
            }
            catch (error) {
                expect(error).toBeInstanceOf(RelationalEdgeStillReferencedError)
                expect((error as RelationalEdgeStillReferencedError).id).toBe(OBJECT_A)
                expect((error as RelationalEdgeStillReferencedError).hostId).toBe(HOST_ID)
            }
        })

        it('throws when the object is only the edge target, not just the source', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_B, to: OBJECT_A, kind: 'On' }],
            })
            expect(() => graph.removeObject(OBJECT_A)).toThrow(RelationalEdgeStillReferencedError)
        })

        it('succeeds and removes the node when no relational edge references the object', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [],
            })
            expect(graph.removeObject(OBJECT_A).toStored().nodes).toEqual([objectNode(OBJECT_B)])
        })

        it('still silently strips a play-only (exit) edge referencing the object when no relational edge remains', () => {
            const exitEdge: StandardExitEdgeData = {
                tag: 'Exit',
                uuid: 'edge-asserted',
                from: OBJECT_A,
                to: OBJECT_B,
                payload: {},
            }
            const graph = EphemeraLudicGraph.fromPlayEnvelope(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [exitEdge],
            })
            expect(() => graph.removeObject(OBJECT_A)).not.toThrow()
            expect(graph.removeObject(OBJECT_A).toPlayEnvelope().edges ?? []).toEqual([])
        })

        it('preserves unrelated relational edges after a successful assert', () => {
            const relational = { tag: 'Relational' as const, from: OBJECT_A, to: OBJECT_C, kind: 'On' as const }
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B), objectNode(OBJECT_C)],
                edges: [relational],
            })
            expect(graph.removeObject(OBJECT_B).toStored().edges).toEqual([relational])
        })
    })

    describe('removeCharacter (BD-36 assert-and-throw, vacuous today)', () => {
        it('never throws --- relational edges cannot reference a character, so the assert is always satisfied', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            expect(() => graph.removeCharacter(CHARACTER_A)).not.toThrow()
        })

        it('removes the matching character node', () => {
            const graph = seedFromActiveCharacters([
                { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
                { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
            ], HOST_ID)
            expect(graph.removeCharacter(CHARACTER_A).toStored().nodes).toEqual([characterNode(CHARACTER_B)])
        })
    })

    describe('construction and serialization', () => {
        it('empty creates host-bound graph with no nodes', () => {
            expect(EphemeraLudicGraph.empty(HOST_ID).toStored()).toEqual({ nodes: [] })
            expect(EphemeraLudicGraph.empty(HOST_ID).hostId).toBe(HOST_ID)
        })

        it('fromJSON and fromFieldPayload are equivalent', () => {
            const payload = {
                nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
                edges: [{ tag: 'Relational' as const, from: OBJECT_A, to: OBJECT_B, kind: 'On' as const }],
            }
            const fromJSON = EphemeraLudicGraph.fromJSON({ hostId: HOST_ID, ...payload })
            const fromField = EphemeraLudicGraph.fromFieldPayload(HOST_ID, payload)
            expect(fromJSON.equals(fromField)).toBe(true)
        })

        it('survives Immer draft revocation --- fromFieldPayload must plain-copy nodes/edges, not retain the draft\'s own element references (regression: MultiKeyUpdate reducers in mtw-utilities/ts/dynamoDB/mixins/transact.ts build their draft via immer produce(), which revokes every draft proxy the instant the reducer returns; a graph built from that draft and retained past the reducer throws "Cannot perform \'get\' on a proxy that has been revoked" on first node/edge property read otherwise)', () => {
            const { produce } = require('immer')
            let escapedGraph: EphemeraLudicGraph | undefined
            produce({ positionGraph: { nodes: [objectNode(OBJECT_A)], edges: [{ tag: 'Relational' as const, from: OBJECT_A, to: OBJECT_B, kind: 'On' as const }] } }, (draft: any) => {
                escapedGraph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, draft.positionGraph)
            })
            // The producer has returned; `draft` and everything reachable from it is now revoked.
            expect(() => escapedGraph!.toPlayEnvelope()).not.toThrow()
            expect(escapedGraph!.toStored()).toEqual({
                nodes: [objectNode(OBJECT_A)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
        })

        it('toJSON includes hostId; toStored omits it', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { nodes: [characterNode(CHARACTER_A)] })
            expect(graph.toJSON()).toEqual({
                hostId: HOST_ID,
                nodes: [characterNode(CHARACTER_A)],
            })
            expect(graph.toStored()).toEqual({ nodes: [characterNode(CHARACTER_A)] })
        })

        it('fromPlayEnvelope preserves character and object nodes', () => {
            const graph = EphemeraLudicGraph.fromPlayEnvelope(HOST_ID, {
                nodes: [
                    { tag: 'Character', universalKey: CHARACTER_A },
                    { tag: 'Object', universalKey: OBJECT_A },
                ],
                edges: [],
            })
            expect(graph.toStored()).toEqual({
                nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
            })
        })

        it('toPlayEnvelope round-trips topology', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [characterNode(CHARACTER_A), objectNode(OBJECT_A)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            expect(graph.toPlayEnvelope()).toEqual({
                nodes: [
                    { tag: 'Character', universalKey: CHARACTER_A },
                    { tag: 'Object', universalKey: OBJECT_A },
                ],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
        })

        it('clone produces equal independent instance', () => {
            const graph = seedFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }], HOST_ID)
            const cloned = graph.clone()
            expect(cloned).not.toBe(graph)
            expect(cloned.equals(graph)).toBe(true)
        })

        it('equals returns false for different hostId', () => {
            const a = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { nodes: [characterNode(CHARACTER_A)] })
            const b = EphemeraLudicGraph.fromFieldPayload(OTHER_HOST_ID, { nodes: [characterNode(CHARACTER_A)] })
            expect(a.equals(b)).toBe(false)
        })
    })

    describe('factories', () => {
        it('fromRoomMeta uses ludicGraph when present', () => {
            const payload = { nodes: [objectNode(OBJECT_A)], edges: [] as [] }
            const graph = fromRoomMeta({ ludicGraph: payload, activeCharacters: [] }, HOST_ID)
            expect(graph.toStored()).toEqual(payload)
        })

        it('fromRoomMeta seeds from activeCharacters when ludicGraph absent', () => {
            const graph = fromRoomMeta({
                activeCharacters: [{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }],
            }, HOST_ID)
            expect(graph.toStored().nodes).toEqual([characterNode(CHARACTER_A)])
        })

        it('fromCharacterMeta uses ludicGraph or empty graph', () => {
            expect(fromCharacterMeta({}, HOST_ID).toStored()).toEqual({ nodes: [], edges: [] })
            const payload = { nodes: [objectNode(OBJECT_A)], edges: [] as [] }
            expect(fromCharacterMeta({ ludicGraph: payload }, HOST_ID).toStored()).toEqual(payload)
        })
    })

    describe('relational edges', () => {
        const graphWithObjects = () =>
            EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [],
            })

        it('extractRelationalEdgesFromStored ignores Exit edges', () => {
            const edges = extractRelationalEdgesFromStored({
                nodes: [],
                edges: [
                    { tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' },
                    { to: 'ROOM#Elsewhere', from: OBJECT_A, description: 'north' },
                ] as unknown as [],
            })
            expect(edges).toEqual([{ from: OBJECT_A, to: OBJECT_B, kind: 'On' }])
        })

        it('edgesMatch distinguishes Custom relationLabel', () => {
            expect(edgesMatch(
                { from: OBJECT_A, to: OBJECT_B, kind: 'On' },
                { from: OBJECT_A, to: OBJECT_B, kind: 'On' }
            )).toBe(true)
            expect(edgesMatch(
                { from: OBJECT_A, to: OBJECT_B, kind: 'Custom', relationLabel: 'leaning' },
                { from: OBJECT_A, to: OBJECT_B, kind: 'Custom', relationLabel: 'leaning' }
            )).toBe(true)
            expect(edgesMatch(
                { from: OBJECT_A, to: OBJECT_B, kind: 'Custom', relationLabel: 'leaning' },
                { from: OBJECT_A, to: OBJECT_B, kind: 'Custom', relationLabel: 'against' }
            )).toBe(false)
        })

        it('toStoredRelationalEdge includes relationLabel for Custom only', () => {
            expect(toStoredRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })).toEqual({
                tag: 'Relational',
                from: OBJECT_A,
                to: OBJECT_B,
                kind: 'On',
            })
            expect(toStoredRelationalEdge({
                from: OBJECT_A,
                to: OBJECT_B,
                kind: 'Custom',
                relationLabel: 'leaning',
            })).toEqual({
                tag: 'Relational',
                from: OBJECT_A,
                to: OBJECT_B,
                kind: 'Custom',
                relationLabel: 'leaning',
            })
        })

        it('bothObjectsOnGraph requires both objects on graph', () => {
            const graph = graphWithObjects()
            expect(graph.bothObjectsOnGraph(OBJECT_A, OBJECT_B)).toBe(true)
            expect(graph.bothObjectsOnGraph(OBJECT_A, 'OBJECT#Missing' as EphemeraObjectId)).toBe(false)
        })

        it('nodeHasRelationalEdge detects endpoint participation', () => {
            const graph = graphWithObjects().addRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })
            expect(graph.nodeHasRelationalEdge(OBJECT_A)).toBe(true)
            expect(graph.nodeHasRelationalEdge(OBJECT_B)).toBe(true)
            expect(graph.nodeHasRelationalEdge('OBJECT#Missing' as EphemeraObjectId)).toBe(false)
        })

        it('addRelationalEdge appends stored edge', () => {
            const next = graphWithObjects().addRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })
            expect(next.toStored().edges).toEqual([{
                tag: 'Relational',
                from: OBJECT_A,
                to: OBJECT_B,
                kind: 'On',
            }])
        })

        it('addRelationalEdge is idempotent for exact edge', () => {
            const graph = graphWithObjects().addRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })
            expect(graph.addRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })).toBe(graph)
        })

        it('removeRelationalEdge filters by match', () => {
            const graph = graphWithObjects().addRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' })
            expect(graph.removeRelationalEdge({ from: OBJECT_A, to: OBJECT_B, kind: 'On' }).toStored().edges).toEqual([])
        })
    })

    describe('applyRelationalPatch', () => {
        const onTablePatch = {
            hostId: HOST_ID,
            edge: { from: OBJECT_A, to: OBJECT_B, kind: 'On' as const },
            op: 'add' as const,
        }

        it('adds relational edge when nodes present', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            const next = graph.applyRelationalPatch(onTablePatch)
            expect(next.relationalEdges).toEqual([{ from: OBJECT_A, to: OBJECT_B, kind: 'On' }])
        })

        it('returns same instance on idempotent add', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            expect(graph.applyRelationalPatch(onTablePatch)).toBe(graph)
        })

        it('removes edge when present', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            const next = graph.applyRelationalPatch({ ...onTablePatch, op: 'remove' })
            expect(next.relationalEdges).toEqual([])
        })

        it('throws when removing absent edge', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            expect(() => graph.applyRelationalPatch({ ...onTablePatch, op: 'remove' }))
                .toThrow(/not present/)
        })

        it('throws when nodes missing from graph', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A)],
            })
            expect(() => graph.applyRelationalPatch(onTablePatch))
                .toThrow(/not on host/)
        })

        it('rejects wrong hostId', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            expect(() => graph.applyRelationalPatch({ ...onTablePatch, hostId: OTHER_HOST_ID }))
                .toThrow(/does not match graph hostId/)
        })
    })
})
