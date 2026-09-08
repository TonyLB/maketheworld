import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { applyTransferSet } from './applyTransferSet'
import { testLudicGraph } from '../testFixtures'
import { RelationalEdgeStillReferencedError } from '../index'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Lobby' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyTransferSet', () => {
    it('legal: moves a complete set with no boundary edges and mutates both graphs', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(trayId)).toBe(false)
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
    })

    it("legal: BD-13's worked example, with the tray-table dissolve edge already explicitly removed", () => {
        // Simulates an explicit DissolveRelationStep having already run in the same kernel-apply
        // loop --- the real precondition this function assumes.
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
            ],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(tableId)).toBe(true)
        expect(outcome.sourceGraph.relationalEdges).toEqual([])
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
        expect(outcome.destGraph.objectIds.has(glassId)).toBe(true)
        expect(outcome.destGraph.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])
    })

    it('illegal (unresolvedDissolveEdge): the tray-table dissolve edge was NOT pre-removed', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
                { tag: 'Relational', from: trayId, to: tableId, kind: 'Against' },
            ],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))

        // A discriminated result, not a thrown RelationalEdgeStillReferencedError --- keeps
        // dry-run callers on a discriminated result, per the design doc. `repairable` rather than
        // a flat rejection: the missing DissolveRelationStep is exactly what a re-proposing caller
        // would add, and the edge to aim it at rides along.
        expect(outcome).toEqual({
            verdict: 'repairable',
            reasonCode: 'unresolvedDissolveEdge',
            authority: 'mechanical',
            edge: { from: trayId, to: tableId, kind: 'Against' },
        })
    })

    // The former "illegal: an incomplete transfer set (unaccounted carry boundary edge)" test is
    // retired 2026-08-22 (Channel D, CD2, reduced scope): `incompleteTransferSet` was only returned
    // when `boundaryEdgeOutcomes` found a `carry` outcome, and `carry` was unreachable from any
    // relation kind even then -- `On` (its only producer) had already joined `In`/`PartOf`'s
    // hosting-kind throw. CD3 (2026-09-06) formally retired the branch that checked for it.

    it('repairable/worldChanging: an Under boundary edge on the subject moving requires interaction assessment', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Under' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        // `worldChanging`, not `mechanical`: severing this edge moves the table's tray, which the
        // player did not ask for. The distinction is recorded here and acted on by repair policy.
        expect(outcome).toEqual({
            verdict: 'repairable',
            reasonCode: 'transferInteractionDefer',
            authority: 'worldChanging',
            edge: { from: trayId, to: tableId, kind: 'Under' },
        })
    })

    it('irreparable: a Custom boundary edge is undecidable without an LLM validator', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        expect(outcome).toEqual({
            verdict: 'irreparable',
            reasonCode: 'undecidableInteractionEdge',
            edge: { from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
        })
    })

    it('reorder regression: an internal edge between two transferred objects does not spuriously throw', () => {
        // glass On tray: both endpoints are in the transfer set (internal, not boundary). Without
        // stripping internal edges before the per-object removeObject loop, removing tray first
        // would throw on its still-live edge to glass (not yet removed).
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [{ tag: 'Relational', from: glassId, to: trayId, kind: 'On' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        expect(() => applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))).not.toThrow()

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))
        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.destGraph.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])
        expect(outcome.sourceGraph.relationalEdges).toEqual([])
    })

    it('legal: a character-only transfer set dispatches via addCharacter/removeCharacter', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
        const destGraph = testLudicGraph(otherRoomId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([characterId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.characterIds.has(characterId)).toBe(false)
        expect(outcome.destGraph.characterIds.has(characterId)).toBe(true)
    })

    it('legal: a mixed object+character transfer set lands both under one call', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Character', universalKey: characterId },
            ],
        })
        const destGraph = testLudicGraph(otherRoomId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, characterId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(trayId)).toBe(false)
        expect(outcome.sourceGraph.characterIds.has(characterId)).toBe(false)
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
        expect(outcome.destGraph.characterIds.has(characterId)).toBe(true)
    })

    it('never leaks a raw RelationalEdgeStillReferencedError past an unresolved boundary dissolve edge', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'On' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        expect(() => applyTransferSet(sourceGraph, destGraph, new Set([trayId]))).not.toThrow(
            RelationalEdgeStillReferencedError
        )
    })
})
