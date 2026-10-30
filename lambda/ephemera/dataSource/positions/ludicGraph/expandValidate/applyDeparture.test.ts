import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { applyDeparture } from './applyDeparture'
import { testLudicGraph } from '../testFixtures'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyDeparture', () => {
    it('legal: removes an object with no boundary edges', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })

        const outcome = applyDeparture(sourceGraph, trayId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(trayId)).toBe(false)
    })

    it('legal: the object left behind keeps its place once the boundary edge is already explicitly removed', () => {
        // Simulates an explicit dissolveRelation step having already run in the same kernel-apply
        // loop --- the real precondition this function assumes.
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
        })

        const outcome = applyDeparture(sourceGraph, trayId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(tableId)).toBe(true)
    })

    // Temporary pin: the block routing slice (AGENT.securedTo.planning.md Slice 3) replaces this throw with a refuse outcome.
    it('throws on a SecuredTo boundary edge until block outcomes are routed (never called legal)', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'SecuredTo' }],
        })

        expect(() => applyDeparture(sourceGraph, trayId)).toThrow(/'SecuredTo' boundary edge blocks the move/)
    })

    it('repairable/dissolveRelationalEdge: a ConnectedTo boundary edge (a part leaving its whole) defers like a non-Custom edge', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'ConnectedTo' }],
        })

        const outcome = applyDeparture(sourceGraph, trayId)

        expect(outcome).toEqual(expect.objectContaining({
            verdict: 'repairable',
            reasonCode: 'transferInteractionDefer',
            repairKind: 'dissolveRelationalEdge',
            authority: 'worldChanging',
        }))
    })

    it('repairable/classifyCustomRelation: a Custom boundary edge names the decision it needs, not a severing', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })

        const outcome = applyDeparture(sourceGraph, trayId)

        // A discriminated result, not a thrown RelationalEdgeStillReferencedError --- keeps
        // dry-run callers on a discriminated result. Repairable, because a repair exists ---
        // someone deciding what "tied to" means. What this layer cannot do is *perform* it, and
        // that is the applier's problem to throw on, not a property of the plan to report as
        // unrepairable.
        expect(outcome).toEqual({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
            repairKind: 'classifyCustomRelation',
            authority: 'worldChanging',
            edge: { from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' },
        })
    })

    it('repairable/classifyCustomRelation: a Custom edge on which the mover is the target defers the same way', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: tableId, to: trayId, kind: 'Custom', relationLabel: 'against' }],
        })

        expect(applyDeparture(sourceGraph, trayId)).toMatchObject({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
        })
    })

    it('legal: a character is removed via removeCharacter', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })

        const outcome = applyDeparture(sourceGraph, characterId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.characterIds.has(characterId)).toBe(false)
    })
})
