import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { applyTransfer } from './applyTransfer'
import { testLudicGraph } from '../testFixtures'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const otherRoomId = 'ROOM#Lobby' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyTransfer', () => {
    it('legal: moves an object with no boundary edges and mutates both graphs', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransfer(sourceGraph, destGraph, trayId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(trayId)).toBe(false)
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
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
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransfer(sourceGraph, destGraph, trayId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(tableId)).toBe(true)
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
    })

    it('repairable/classifyCustomRelation: a Custom boundary edge names the decision it needs, not a severing', () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        const outcome = applyTransfer(sourceGraph, destGraph, trayId)

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
        const destGraph = testLudicGraph(characterId, { nodes: [] })

        expect(applyTransfer(sourceGraph, destGraph, trayId)).toMatchObject({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
        })
    })

    it('legal: a character dispatches via addCharacter/removeCharacter', () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Character', universalKey: characterId }] })
        const destGraph = testLudicGraph(otherRoomId, { nodes: [] })

        const outcome = applyTransfer(sourceGraph, destGraph, characterId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.characterIds.has(characterId)).toBe(false)
        expect(outcome.destGraph.characterIds.has(characterId)).toBe(true)
    })
})
