import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import {
    edgeReferencesObjectId,
    edgesMatch,
    EphemeraLudicGraph,
    RelationalEdgeStillReferencedError,
    areaNode,
    characterNode,
    featureNode,
    fromAreaMeta,
    fromCharacterMeta,
    fromFeatureMeta,
    fromObjectMeta,
    fromRoomMeta,
    graphFromMeta,
    hostDataCategory,
    nodeFromId,
    nodeHasRelationalEdge,
    objectNode,
    roomNode,
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
const OBJECT_HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FEATURE_HOST_ID = 'FEATURE#Sign' as EphemeraFeatureId
const AREA_HOST_ID = 'AREA#Overworld' as EphemeraAreaId

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
        it("maps roster to nodes, with the host's own root node first (LP4i)", () => {
            const graph = seedFromActiveCharacters([
                { EphemeraId: CHARACTER_A, DisplayName: 'Alpha' },
                { EphemeraId: CHARACTER_B, DisplayName: 'Beta' },
            ], HOST_ID)
            expect(graph.toStored()).toEqual({
                rootId: HOST_ID, ports: [],
                nodes: [roomNode(HOST_ID), characterNode(CHARACTER_A), characterNode(CHARACTER_B)],
                edges: [],
            })
        })

        it('returns a graph with only the root node for an empty roster (LP4i)', () => {
            expect(seedFromActiveCharacters([], HOST_ID).toStored()).toEqual({ rootId: HOST_ID, ports: [], nodes: [roomNode(HOST_ID)], edges: [] })
        })

        it('rootId defaults to hostId', () => {
            expect(seedFromActiveCharacters([], HOST_ID).rootId).toBe(HOST_ID)
        })
    })

    describe('membership nodes', () => {
        it('addCharacter appends new node', () => {
            const graph = seedFromActiveCharacters([{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }], HOST_ID)
            expect(graph.addCharacter(CHARACTER_B).toStored().nodes).toEqual([
                roomNode(HOST_ID),
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
                roomNode(HOST_ID),
                characterNode(CHARACTER_A),
                objectNode(OBJECT_A),
            ])
        })

        it('addObject is idempotent when object already present', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: HOST_ID, ports: [], nodes: [objectNode(OBJECT_A)], edges: [] })
            expect(graph.addObject(OBJECT_A)).toBe(graph)
        })

        it('objectIds returns set of object universal keys', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: HOST_ID, ports: [], nodes: [objectNode(OBJECT_A)], edges: [] })
            expect(graph.objectIds).toEqual(new Set([OBJECT_A]))
        })
    })

    describe('removeObject (BD-33/BD-35 assert-and-throw)', () => {
        it('throws RelationalEdgeStillReferencedError when a relational edge still references the object', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
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
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_B, to: OBJECT_A, kind: 'On' }],
            })
            expect(() => graph.removeObject(OBJECT_A)).toThrow(RelationalEdgeStillReferencedError)
        })

        it('succeeds and removes the node when no relational edge references the object', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
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
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B), objectNode(OBJECT_C)],
                edges: [relational],
            })
            expect(graph.removeObject(OBJECT_B).toStored().edges).toEqual([relational])
        })
    })

    describe('removeCharacter (BD-36 assert-and-throw, vacuous today)', () => {
        it('never throws --- relational edges cannot reference a character, so the assert is always satisfied', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
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
            expect(graph.removeCharacter(CHARACTER_A).toStored().nodes).toEqual([roomNode(HOST_ID), characterNode(CHARACTER_B)])
        })
    })

    describe('construction and serialization', () => {
        it("empty creates host-bound graph rooted at its own host, with the root's own node present (LP4i, concepts clause 3)", () => {
            expect(EphemeraLudicGraph.empty(HOST_ID).toStored()).toEqual({ rootId: HOST_ID, ports: [], nodes: [roomNode(HOST_ID)] })
            expect(EphemeraLudicGraph.empty(HOST_ID).hostId).toBe(HOST_ID)
            expect(EphemeraLudicGraph.empty(HOST_ID).rootId).toBe(HOST_ID)
        })

        it('fromJSON and fromFieldPayload are equivalent', () => {
            const payload = {
                rootId: HOST_ID, ports: [],
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
            produce({ ludicGraph: { rootId: HOST_ID, ports: [], nodes: [objectNode(OBJECT_A)], edges: [{ tag: 'Relational' as const, from: OBJECT_A, to: OBJECT_B, kind: 'On' as const }] } }, (draft: any) => {
                escapedGraph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, draft.ludicGraph)
            })
            // The producer has returned; `draft` and everything reachable from it is now revoked.
            expect(() => escapedGraph!.toPlayEnvelope()).not.toThrow()
            expect(escapedGraph!.toStored()).toEqual({
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
        })

        it('toJSON includes hostId and rootId; toStored omits hostId only', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)] })
            expect(graph.toJSON()).toEqual({
                hostId: HOST_ID,
                rootId: HOST_ID, ports: [],
                nodes: [characterNode(CHARACTER_A)],
            })
            expect(graph.toStored()).toEqual({ rootId: HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)] })
        })

        it('fromPlayEnvelope preserves character and object nodes, rooted at its own host', () => {
            const graph = EphemeraLudicGraph.fromPlayEnvelope(HOST_ID, {
                nodes: [
                    { tag: 'Character', universalKey: CHARACTER_A },
                    { tag: 'Object', universalKey: OBJECT_A },
                ],
                edges: [],
            })
            expect(graph.rootId).toBe(HOST_ID)
            expect(graph.toStored()).toEqual({
                rootId: HOST_ID, ports: [],
                nodes: [roomNode(HOST_ID), characterNode(CHARACTER_A), objectNode(OBJECT_A)],
            })
        })

        it('toPlayEnvelope round-trips topology', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
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
            const a = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)] })
            const b = EphemeraLudicGraph.fromFieldPayload(OTHER_HOST_ID, { rootId: OTHER_HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)] })
            expect(a.equals(b)).toBe(false)
        })

        it('equals returns false for different rootId, same hostId', () => {
            const a = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)] })
            const b = EphemeraLudicGraph.fromFieldPayload(HOST_ID, { rootId: OBJECT_A, ports: [], nodes: [characterNode(CHARACTER_A)] })
            expect(a.equals(b)).toBe(false)
        })

        // LP7 regression: equals() compared edge.from/.to with raw `!==` (the same "raw ==="
        // shape LP3 swept everywhere else, missed here because from/to were always strings
        // until this slice). A port address is an object, so two structurally-identical port
        // terminals built as separate literals now compare unequal by reference unless equals()
        // routes through ephemeraLudicTerminalsEqual, exactly like edgesMatch already does.
        it('equals treats two structurally-identical port-qualified edge terminals as equal', () => {
            const edge = {
                tag: 'Relational' as const,
                from: { owner: OBJECT_A, port: 'ab6129d' },
                to: OBJECT_B,
                kind: 'On' as const,
            }
            const a = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ ...edge, from: { ...edge.from } }],
            })
            const b = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ ...edge, from: { ...edge.from } }],
            })
            expect(a.equals(b)).toBe(true)
        })

        // LP4d: ports (premise 12) round-trips through fromFieldPayload/toStored/toJSON/fromJSON
        // exactly like nodes/edges --- the egress list is not a special case.
        it('ports round-trips through fromFieldPayload and toStored', () => {
            const ports = [{ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen' as EphemeraRoomId, kind: 'Present' as const }]
            const graph = EphemeraLudicGraph.fromFieldPayload(OBJECT_HOST_ID, {
                rootId: OBJECT_HOST_ID,
                nodes: [objectNode(OBJECT_HOST_ID)],
                ports,
            })
            expect(graph.ports).toEqual(ports)
            expect(graph.toStored().ports).toEqual(ports)
        })

        // LP6: a `Custom` port carries its exterior label, so the round trip must show both
        // new fields surviving --- not just the discriminator.
        it('ports round-trips through toJSON and fromJSON', () => {
            const ports = [{ portId: 'ab6129d', fromHostId: 'ROOM#Kitchen' as EphemeraRoomId, kind: 'Custom' as const, exteriorRelationLabel: 'threads into' }]
            const graph = EphemeraLudicGraph.fromFieldPayload(OBJECT_HOST_ID, {
                rootId: OBJECT_HOST_ID,
                nodes: [objectNode(OBJECT_HOST_ID)],
                ports,
            })
            const json = graph.toJSON()
            expect(json.ports).toEqual(ports)
            expect(EphemeraLudicGraph.fromJSON(json).ports).toEqual(ports)
        })

        it('fromPlayEnvelope produces an empty ports list --- a play envelope carries no port data (presentation lane, out of scope)', () => {
            const graph = EphemeraLudicGraph.fromPlayEnvelope(HOST_ID, { nodes: [] })
            expect(graph.ports).toEqual([])
        })
    })

    describe('factories', () => {
        it('fromRoomMeta uses ludicGraph when present', () => {
            const payload = { rootId: HOST_ID, ports: [], nodes: [objectNode(OBJECT_A)], edges: [] as [] }
            const graph = fromRoomMeta({ ludicGraph: payload, activeCharacters: [] }, HOST_ID)
            expect(graph.toStored()).toEqual(payload)
        })

        it('fromRoomMeta seeds from activeCharacters when ludicGraph absent, root node included (LP4i)', () => {
            const graph = fromRoomMeta({
                activeCharacters: [{ EphemeraId: CHARACTER_A, DisplayName: 'Alpha' }],
            }, HOST_ID)
            expect(graph.toStored().nodes).toEqual([roomNode(HOST_ID), characterNode(CHARACTER_A)])
            expect(graph.rootId).toBe(HOST_ID)
        })

        it('fromCharacterMeta uses ludicGraph or a default graph carrying only its own root node, rooted at hostId (LP4i)', () => {
            expect(fromCharacterMeta({}, HOST_ID).toStored()).toEqual({ rootId: HOST_ID, ports: [], nodes: [nodeFromId(HOST_ID)], edges: [] })
            const payload = { rootId: HOST_ID, ports: [], nodes: [nodeFromId(HOST_ID), objectNode(OBJECT_A)], edges: [] as [] }
            expect(fromCharacterMeta({ ludicGraph: payload }, HOST_ID).toStored()).toEqual(payload)
        })

        it('fromObjectMeta uses ludicGraph or a default graph carrying only its own root node, rooted at hostId (LP4i)', () => {
            expect(fromObjectMeta({}, OBJECT_HOST_ID).toStored()).toEqual({ rootId: OBJECT_HOST_ID, ports: [], nodes: [objectNode(OBJECT_HOST_ID)], edges: [] })
            const payload = { rootId: OBJECT_HOST_ID, ports: [], nodes: [objectNode(OBJECT_HOST_ID), characterNode(CHARACTER_A)], edges: [] as [] }
            expect(fromObjectMeta({ ludicGraph: payload }, OBJECT_HOST_ID).toStored()).toEqual(payload)
        })

        it('fromFeatureMeta uses ludicGraph or a default graph carrying only its own root node, rooted at hostId (LP4i)', () => {
            expect(fromFeatureMeta({}, FEATURE_HOST_ID).toStored()).toEqual({ rootId: FEATURE_HOST_ID, ports: [], nodes: [featureNode(FEATURE_HOST_ID)], edges: [] })
            const payload = { rootId: FEATURE_HOST_ID, ports: [], nodes: [featureNode(FEATURE_HOST_ID), characterNode(CHARACTER_A)], edges: [] as [] }
            expect(fromFeatureMeta({ ludicGraph: payload }, FEATURE_HOST_ID).toStored()).toEqual(payload)
        })

        it('fromAreaMeta uses ludicGraph or a default graph carrying only its own root node, rooted at hostId (LP4i)', () => {
            expect(fromAreaMeta({}, AREA_HOST_ID).toStored()).toEqual({ rootId: AREA_HOST_ID, ports: [], nodes: [areaNode(AREA_HOST_ID)], edges: [] })
            const payload = { rootId: AREA_HOST_ID, ports: [], nodes: [areaNode(AREA_HOST_ID), characterNode(CHARACTER_A)], edges: [] as [] }
            expect(fromAreaMeta({ ludicGraph: payload }, AREA_HOST_ID).toStored()).toEqual(payload)
        })

        it('hostDataCategory dispatches Room/Object/Feature/Area/Character correctly', () => {
            expect(hostDataCategory(HOST_ID)).toBe('Meta::Room')
            expect(hostDataCategory(OBJECT_HOST_ID)).toBe('Meta::Object')
            expect(hostDataCategory(FEATURE_HOST_ID)).toBe('Meta::Feature')
            expect(hostDataCategory(AREA_HOST_ID)).toBe('Meta::Area')
            expect(hostDataCategory(CHARACTER_A)).toBe('Meta::Character')
        })

        it('graphFromMeta dispatches an Object host through fromObjectMeta', () => {
            const payload = { rootId: OBJECT_HOST_ID, ports: [], nodes: [objectNode(OBJECT_A)], edges: [] as [] }
            const graph = graphFromMeta({ ludicGraph: payload }, OBJECT_HOST_ID)
            expect(graph.hostId).toBe(OBJECT_HOST_ID)
            expect(graph.toStored()).toEqual(payload)
        })

        it('graphFromMeta dispatches a Feature host through fromFeatureMeta', () => {
            const payload = { rootId: FEATURE_HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)], edges: [] as [] }
            const graph = graphFromMeta({ ludicGraph: payload }, FEATURE_HOST_ID)
            expect(graph.hostId).toBe(FEATURE_HOST_ID)
            expect(graph.toStored()).toEqual(payload)
        })

        it('graphFromMeta dispatches an Area host through fromAreaMeta', () => {
            const payload = { rootId: AREA_HOST_ID, ports: [], nodes: [characterNode(CHARACTER_A)], edges: [] as [] }
            const graph = graphFromMeta({ ludicGraph: payload }, AREA_HOST_ID)
            expect(graph.hostId).toBe(AREA_HOST_ID)
            expect(graph.toStored()).toEqual(payload)
        })
    })

    describe('relational edges', () => {
        const graphWithObjects = () =>
            EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
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

        // LP4c-i: extractRelationalEdgesFromStored's fallback branch has its own
        // HOST_RELATIONAL_EDGE_KINDS Set literal (baseClasses.ts), separate from
        // ephemeraMeta.ts's. A stale Set here fails silently -- the edge is simply never
        // pushed -- so this must be checked directly, not inferred from the primary-path test.
        // Direction corrected 2026-08-20 (LD-16): containment runs member -> root, matching the
        // subject-predicate-object convention every other kind already follows.
        it.each(['In', 'PartOf'] as const)('extractRelationalEdgesFromStored survives a %s containment edge', (kind) => {
            const edges = extractRelationalEdgesFromStored({
                nodes: [],
                edges: [
                    { tag: 'Relational', from: OBJECT_A, to: HOST_ID, kind },
                ] as unknown as [],
            })
            expect(edges).toEqual([{ from: OBJECT_A, to: HOST_ID, kind }])
        })

        // Presence plan PR-4 (reading (d)): 'Present' is a third, partitioning kind, and
        // extractRelationalEdgesFromStored's fallback branch has its own HOST_RELATIONAL_EDGE_KINDS
        // Set literal (baseClasses.ts), separate from ephemeraMeta.ts's -- same lockstep-Set
        // hazard as the In/PartOf test above, checked directly rather than inferred.
        it('extractRelationalEdgesFromStored survives a Present edge', () => {
            const edges = extractRelationalEdgesFromStored({
                nodes: [],
                edges: [
                    { tag: 'Relational', from: { owner: HOST_ID, port: 'ab6129d' }, to: OBJECT_A, kind: 'Present' },
                ] as unknown as [],
            })
            expect(edges).toEqual([{ from: { owner: HOST_ID, port: 'ab6129d' }, to: OBJECT_A, kind: 'Present' }])
        })

        // LP7 regression, primary path: a well-formed port-qualified edge now satisfies
        // isEphemeraLudicRelationalEdgeData directly, so extractRelationalEdgesFromStored's
        // first branch (not the fallback) is what survives it here.
        it('extractRelationalEdgesFromStored survives a port-qualified edge on the primary path', () => {
            const edges = extractRelationalEdgesFromStored({
                nodes: [],
                edges: [
                    { tag: 'Relational', from: { owner: OBJECT_A, port: 'ab6129d' }, to: OBJECT_B, kind: 'On' },
                    { to: 'ROOM#Elsewhere', from: OBJECT_A, description: 'north' },
                ] as unknown as [],
            })
            expect(edges).toEqual([{ from: { owner: OBJECT_A, port: 'ab6129d' }, to: OBJECT_B, kind: 'On' }])
        })

        // LP7 regression, fallback path specifically: a Custom edge with an empty relationLabel
        // fails isEphemeraLudicRelationalEdgeData's Custom-requires-non-empty-label check, so this
        // is the one shape that actually reaches extractRelationalEdgesFromStored's manual fallback
        // parse -- the hazard is a valid edge silently vanishing there, not an invalid one being
        // rejected, so an accept-only test on the primary path would have missed the fallback's own
        // typeof pre-check still rejecting the port address.
        it('extractRelationalEdgesFromStored survives a port-qualified edge through the fallback branch', () => {
            const edges = extractRelationalEdgesFromStored({
                nodes: [],
                edges: [
                    { tag: 'Relational', from: { owner: OBJECT_A, port: 'ab6129d' }, to: OBJECT_B, kind: 'Custom', relationLabel: '' },
                ] as unknown as [],
            })
            expect(edges).toEqual([{ from: { owner: OBJECT_A, port: 'ab6129d' }, to: OBJECT_B, kind: 'Custom', relationLabel: '' }])
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

        // LP4: from/to admit any legal host-kind component now (any node's universalKey), not
        // only Objects -- this is the regression test that would have caught the original
        // narrowness, when bothObjectsOnGraph checked presence against `objectIds` only.
        it('bothObjectsOnGraph finds a non-Object terminal by its node presence', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), { tag: 'Room', universalKey: 'ROOM#Nested' as EphemeraRoomId }],
                edges: [],
            })
            expect(graph.bothObjectsOnGraph(OBJECT_A, 'ROOM#Nested' as EphemeraRoomId)).toBe(true)
            expect(graph.bothObjectsOnGraph(OBJECT_A, 'ROOM#Missing' as EphemeraRoomId)).toBe(false)
        })

        it('nodeHasRelationalEdge detects a Room terminal participating in an edge', () => {
            const edges = [{ from: OBJECT_A, to: 'ROOM#Nested' as EphemeraRoomId, kind: 'On' as const }]
            expect(nodeHasRelationalEdge('ROOM#Nested' as EphemeraRoomId, edges)).toBe(true)
            expect(nodeHasRelationalEdge('ROOM#Missing' as EphemeraRoomId, edges)).toBe(false)
        })

        // LP4i payoff test: a containment edge names the graph's own root as its endpoint
        // (LD-16: member -> root, e.g. `crystalBall -In-> kitchen`). Before LP4i, no
        // construction path put the root in `nodes`, so this failed `bothObjectsOnGraph` even
        // though the edge is legal by every other rule -- the concrete bug this slice fixes.
        it("bothObjectsOnGraph validates a containment edge naming the graph's own root, now that the root is present in nodes", () => {
            const graph = EphemeraLudicGraph.empty(HOST_ID).addObject(OBJECT_A)
            expect(graph.bothObjectsOnGraph(OBJECT_A, HOST_ID)).toBe(true)
        })

        // LP3/PQ-10 originally: `EphemeraLudicRelationalEdgeData.from`/`.to` were
        // `EphemeraLudicTerminalPrimitive`-typed as of LP4 (no port-address terminals yet), and
        // `isEphemeraLudicRelationalEdgeData` correctly rejected a non-string terminal (fixed in
        // the same change -- it used to throw instead of returning `false`). A port-qualified
        // terminal could not reach a *stored-edge* read path (`removeObject`/`edgeReferencesObjectId`
        // on parsed data) through any typed or validated production call at that point. **LP7
        // (2026-08-22) widens the schema and both guards together**, so that boundary test below
        // now asserts acceptance rather than rejection.
        describe('port-qualified terminals (LP3/PQ-10/LP7)', () => {
            const portTerminal = (owner: EphemeraObjectId, port: string) => ({ owner, port })

            it('bothObjectsOnGraph resolves a port-qualified terminal to its owner', () => {
                const graph = graphWithObjects()
                expect(graph.bothObjectsOnGraph(portTerminal(OBJECT_A, 'ab6129d') as unknown as EphemeraObjectId, OBJECT_B)).toBe(true)
                expect(graph.bothObjectsOnGraph(portTerminal(OBJECT_C, 'ab6129d') as unknown as EphemeraObjectId, OBJECT_B)).toBe(false)
            })

            it('nodeHasRelationalEdge finds a port-qualified edge (the original vacuous-pass hazard, at the level reachable today)', () => {
                const edges = [{ from: portTerminal(OBJECT_A, 'ab6129d') as unknown as EphemeraObjectId, to: OBJECT_B, kind: 'On' as const }]
                expect(nodeHasRelationalEdge(OBJECT_A, edges)).toBe(true)
                expect(nodeHasRelationalEdge(OBJECT_C, edges)).toBe(false)
            })

            it('edgesMatch distinguishes a port-qualified terminal from its bare owner', () => {
                const bare = { from: OBJECT_A, to: OBJECT_B, kind: 'On' as const }
                const portQualified = { from: portTerminal(OBJECT_A, 'ab6129d') as unknown as EphemeraObjectId, to: OBJECT_B, kind: 'On' as const }
                expect(edgesMatch(bare, portQualified)).toBe(false)
                expect(edgesMatch(portQualified, portQualified)).toBe(true)
            })

            it('edgeReferencesObjectId finds a port-qualified raw edge by its owner (LP7)', () => {
                // Before LP7, isEphemeraLudicRelationalEdgeData rejected a port-address terminal
                // outright (a non-string .from), so this returned false rather than throwing. LP7
                // widens the schema to admit it, so the correct behavior is now to find the owner.
                const rawEdge = { tag: 'Relational', from: portTerminal(OBJECT_A, 'ab6129d'), to: OBJECT_B, kind: 'On' }
                expect(() => edgeReferencesObjectId(rawEdge, OBJECT_A)).not.toThrow()
                expect(edgeReferencesObjectId(rawEdge, OBJECT_A)).toBe(true)
                expect(edgeReferencesObjectId(rawEdge, OBJECT_C)).toBe(false)
            })
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
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            const next = graph.applyRelationalPatch(onTablePatch)
            expect(next.relationalEdges).toEqual([{ from: OBJECT_A, to: OBJECT_B, kind: 'On' }])
        })

        it('returns same instance on idempotent add', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            expect(graph.applyRelationalPatch(onTablePatch)).toBe(graph)
        })

        it('removes edge when present', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
                edges: [{ tag: 'Relational', from: OBJECT_A, to: OBJECT_B, kind: 'On' }],
            })
            const next = graph.applyRelationalPatch({ ...onTablePatch, op: 'remove' })
            expect(next.relationalEdges).toEqual([])
        })

        it('throws when removing absent edge', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            expect(() => graph.applyRelationalPatch({ ...onTablePatch, op: 'remove' }))
                .toThrow(/not present/)
        })

        it('throws when nodes missing from graph', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A)],
            })
            expect(() => graph.applyRelationalPatch(onTablePatch))
                .toThrow(/not on host/)
        })

        it('rejects wrong hostId', () => {
            const graph = EphemeraLudicGraph.fromFieldPayload(HOST_ID, {
                rootId: HOST_ID, ports: [],
                nodes: [objectNode(OBJECT_A), objectNode(OBJECT_B)],
            })
            expect(() => graph.applyRelationalPatch({ ...onTablePatch, hostId: OTHER_HOST_ID }))
                .toThrow(/does not match graph hostId/)
        })
    })
})
