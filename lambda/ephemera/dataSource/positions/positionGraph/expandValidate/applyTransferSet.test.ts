import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { applyTransferSet } from './applyTransferSet'
import { testPositionGraph } from '../testFixtures'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const bookId = 'OBJECT#Book' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyTransferSet', () => {
    it('legal: moves a complete set with no boundary edges and mutates both graphs', () => {
        const sourceGraph = testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testPositionGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(trayId)).toBe(false)
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
    })

    it("legal: BD-13's worked example --- dissolves tray-table (auto, via removeObject) and carries glass-tray", () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
                { tag: 'Relational', from: trayId, to: tableId, kind: 'On' },
            ],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return
        expect(outcome.sourceGraph.objectIds.has(tableId)).toBe(true)
        expect(outcome.sourceGraph.relationalEdges).toEqual([])
        expect(outcome.destGraph.objectIds.has(trayId)).toBe(true)
        expect(outcome.destGraph.objectIds.has(glassId)).toBe(true)
        expect(outcome.destGraph.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])
    })

    it('illegal: an incomplete transfer set (unaccounted carry boundary edge) is rejected, not auto-grown', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: bookId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
                { tag: 'Relational', from: bookId, to: trayId, kind: 'On' },
            ],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })

        // Caller only asked to transfer [tray, glass] --- book On tray is an unaccounted carry.
        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId, glassId]))

        expect(outcome).toEqual({ verdict: 'illegal', reasonCode: 'incompleteTransferSet' })
    })

    it('defer: an Under boundary edge on the subject moving requires interaction assessment', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Under' }],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        expect(outcome).toEqual({ verdict: 'defer', decidable: true, reasonCode: 'transferInteractionDefer' })
    })

    it('defer: a Custom boundary edge is not decidable', () => {
        const sourceGraph = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const destGraph = testPositionGraph(characterId, { nodes: [] })

        const outcome = applyTransferSet(sourceGraph, destGraph, new Set([trayId]))

        expect(outcome).toEqual({ verdict: 'defer', decidable: false, reasonCode: 'transferInteractionDefer' })
    })
})
