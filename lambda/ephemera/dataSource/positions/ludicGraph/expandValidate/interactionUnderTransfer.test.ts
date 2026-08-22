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
    // `On` joined `In`/`PartOf` here 2026-08-22 (Channel D, CD2, reduced scope): it is a
    // hosting kind too, now dormant at ingress and asserted as an invariant here, same as
    // its two siblings, even though the real shard-hosting mechanism remains unbuilt (CC3-gated).
    it.each(['On', 'In', 'PartOf'] as const)('throws naming AB-54 for %s, rather than classifying a hosting kind', (relationKind) => {
        expect(() => classifyInteractionUnderTransfer(relationKind, 'subject')).toThrow(/AB-54/)
        expect(() => classifyInteractionUnderTransfer(relationKind, 'target')).toThrow(/AB-54/)
    })

    // Presence plan PR-4 (reading (d)): 'Present' is a distinct, partitioning kind -- not a
    // hosting kind -- so its throw names PR-4/reading (d) rather than AB-53/AB-54, which is a
    // claim about hosting-kind incidence that doesn't apply here.
    it('throws naming PR-4 for Present, rather than classifying a partitioning kind', () => {
        expect(() => classifyInteractionUnderTransfer('Present', 'subject')).toThrow(/PR-4/)
        expect(() => classifyInteractionUnderTransfer('Present', 'target')).toThrow(/PR-4/)
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
//
// `carry` was only ever produced by `On` (case 'On': target -> 'carry'), and `On` joined
// the hosting-kind throw 2026-08-22 (Channel D, CD2, reduced scope) -- so absorption is now
// dead code, reachable by no relation kind. The former "absorbs an On edge" tests are gone;
// what replaces them documents the two live consequences: no peer kind ever absorbs (unchanged),
// and a hosting-kind edge reachable during the walk now throws rather than being silently
// skipped, which is a real, currently-shipped edge case, not a hypothetical -- a room holding
// a pre-existing `On` edge (from before this change) that gets transferred will hit it, hence
// this slice's one-time data check. Collapsing computeCarryClosure to a shard read once
// nothing can throw here either is CD3, deliberately deferred.
describe('computeCarryClosure', () => {
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

    it('does not absorb across an Against edge either -- no kind produces carry any more', () => {
        const aAgainstB: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: aId, to: bId, kind: 'Against' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: aId },
                { tag: 'Object', universalKey: bId },
            ],
            edges: [aAgainstB],
        })

        const closure = computeCarryClosure(bId, graph)
        expect(closure.rootId).toBe(bId)
        expect(closure.objectIds).toEqual(new Set([bId]))
        expect(closure.relationalEdges).toEqual([])
    })

    it('throws if a hosting-kind edge (On/In/PartOf) is reached during the walk, per the classifier invariant', () => {
        const bookOnTray: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: bookId },
            ],
            edges: [bookOnTray],
        })

        expect(() => computeCarryClosure(trayId, graph)).toThrow(/AB-54/)
    })
})

describe('boundaryEdgeOutcomes', () => {
    it('reports only the true external edge for a resolved transfer set (peer kinds only -- On/In/PartOf throw)', () => {
        const glassAgainstBook: EphemeraLudicRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'Against' }
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: bookId },
                { tag: 'Object', universalKey: glassId },
            ],
            edges: [glassAgainstBook],
        })
        const closure = computeCarryClosure(bookId, graph)

        const outcomes = boundaryEdgeOutcomes(closure.objectIds, graph)

        expect(outcomes).toHaveLength(1)
        expect(outcomes[0]).toEqual({
            edge: { from: glassId, to: bookId, kind: 'Against' },
            movedRole: 'target',
            outcome: 'dissolve',
        })
    })
})
