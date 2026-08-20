import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from '../testFixtures'
import {
    boundaryEdgeOutcomes,
    classifyInteractionUnderTransfer,
    computeCarryClosure,
    roleOfObjectInEdge,
} from './interactionUnderTransfer'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const bookId = 'OBJECT#Book' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const bootsId = 'OBJECT#Boots' as EphemeraObjectId
const aId = 'OBJECT#A' as EphemeraObjectId
const bId = 'OBJECT#B' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

describe('classifyInteractionUnderTransfer', () => {
    it.each([
        ['On', 'subject', 'dissolve'],
        ['On', 'target', 'carry'],
        ['Under', 'subject', 'defer'],
        ['Under', 'target', 'dissolve'],
        ['Against', 'subject', 'dissolve'],
        ['Against', 'target', 'dissolve'],
        ['Custom', 'subject', 'defer'],
        ['Custom', 'target', 'defer'],
    ] as const)('%s / %s -> %s', (relationKind, movedRole, expected) => {
        expect(classifyInteractionUnderTransfer(relationKind, movedRole)).toBe(expected)
    })

    // AB-54 (2026-08-19): containment kinds are *hosting* kinds -- the subordinate node lives
    // in its host's own shard -- so they do not appear on the exterior graph this classifier
    // runs over. The throw asserts that invariant rather than standing in for a pending answer.
    // It is scoped to the current constructor discipline (AB-53, iteration 1), not forever:
    // if multi-level graphs land, this test is the thing that should fail and be revisited.
    it.each(['In', 'PartOf'] as const)('throws naming AB-54 for %s, rather than classifying a hosting kind', (relationKind) => {
        expect(() => classifyInteractionUnderTransfer(relationKind, 'subject')).toThrow(/AB-54/)
        expect(() => classifyInteractionUnderTransfer(relationKind, 'target')).toThrow(/AB-54/)
    })
})

describe('roleOfObjectInEdge', () => {
    const edge: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }

    it('returns subject when objectId is the from endpoint', () => {
        expect(roleOfObjectInEdge(bookId, edge)).toBe('subject')
    })

    it('returns target when objectId is the to endpoint', () => {
        expect(roleOfObjectInEdge(trayId, edge)).toBe('target')
    })

    it('returns undefined when objectId is not on the edge', () => {
        expect(roleOfObjectInEdge(glassId, edge)).toBeUndefined()
    })
})

// LP4a: computeCarryClosure returns an EphemeraLudicGraph (the former standalone
// CarryClosureFragment collapsed into it), rooted and hosted at the starting object
// (hostId === rootId === startId). Assertions check .rootId/.objectIds/.relationalEdges
// rather than a bespoke {rootId, members, edges} shape.
describe('computeCarryClosure', () => {
    it('absorbs the subject of an On edge when the target moves (single hop)', () => {
        const bookOnTray: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: bookId },
            ],
            edges: [bookOnTray],
        })

        const closure = computeCarryClosure(trayId, graph)
        expect(closure.rootId).toBe(trayId)
        expect(closure.hostId).toBe(trayId)
        expect(closure.objectIds).toEqual(new Set([trayId, bookId]))
        expect(closure.relationalEdges).toEqual([{ from: bookId, to: trayId, kind: 'On' }])
    })

    it('absorbs a three-deep chain to a fixpoint (glass on book, book on tray, get tray)', () => {
        const glassOnBook: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'On' }
        const bookOnTray: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: bookId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [glassOnBook, bookOnTray],
        })

        const closure = computeCarryClosure(trayId, graph)
        expect(closure.rootId).toBe(trayId)
        expect(closure.objectIds).toEqual(new Set([trayId, bookId, glassId]))
        expect(closure.relationalEdges).toEqual([
            { from: bookId, to: trayId, kind: 'On' },
            { from: glassId, to: bookId, kind: 'On' },
        ])
    })

    it('does not absorb across an Under edge in either direction', () => {
        const bootsUnderTable: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bootsId, to: tableId, kind: 'Under' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: bootsId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [bootsUnderTable],
        })

        const tableClosure = computeCarryClosure(tableId, graph)
        expect(tableClosure.rootId).toBe(tableId)
        expect(tableClosure.objectIds).toEqual(new Set([tableId]))
        expect(tableClosure.relationalEdges).toEqual([])

        const bootsClosure = computeCarryClosure(bootsId, graph)
        expect(bootsClosure.rootId).toBe(bootsId)
        expect(bootsClosure.objectIds).toEqual(new Set([bootsId]))
        expect(bootsClosure.relationalEdges).toEqual([])
    })

    it('terminates on a malformed cyclic edge set instead of looping', () => {
        const aOnB: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: aId, to: bId, kind: 'On' }
        const bOnA: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bId, to: aId, kind: 'On' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: aId },
                { tag: 'Object', universalKey: bId },
            ],
            edges: [aOnB, bOnA],
        })

        const closure = computeCarryClosure(aId, graph)
        expect(closure.rootId).toBe(aId)
        expect(closure.objectIds).toEqual(new Set([aId, bId]))
        expect(closure.relationalEdges).toEqual([{ from: bId, to: aId, kind: 'On' }])
    })
})

describe('boundaryEdgeOutcomes', () => {
    it('reports only the true external edge for a resolved transfer set', () => {
        const glassOnBook: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'On' }
        const bookOnTray: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }
        const trayOnTable: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: trayId, to: tableId, kind: 'On' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: bookId },
                { tag: 'Object', universalKey: glassId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [glassOnBook, bookOnTray, trayOnTable],
        })
        const closure = computeCarryClosure(trayId, graph)

        const outcomes = boundaryEdgeOutcomes(closure.objectIds, graph)

        expect(outcomes).toHaveLength(1)
        expect(outcomes[0]).toEqual({
            edge: { from: trayId, to: tableId, kind: 'On' },
            movedRole: 'subject',
            outcome: 'dissolve',
        })
    })
})
