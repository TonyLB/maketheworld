import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import {
    identityPlanCandidateFromSpan,
    relationalIdentityPlanCandidateFromSpans,
} from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { buildSandboxState } from './sandboxState'
import { applyRelationalStep, applyTransferMembershipStep } from './sandboxStep'
import type { ObjectSpanCandidate } from './spanResolution'
import { testPositionGraph, testPositionGraphFromEnvelope } from '../../../positions/positionGraph/testFixtures'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const bootsId = 'OBJECT#Boots' as EphemeraObjectId

const span = (id: EphemeraObjectId, label: string): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance: 1,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
})

const membershipContext = { sourceHostId: roomId, destinationHostId: characterId }

describe('applyTransferMembershipStep', () => {
    it('behaves identically to validateMembershipPlanDryRun when no relational edges exist (baseline parity)', () => {
        const state = buildSandboxState([
            testPositionGraphFromEnvelope(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(trayId, 'tray'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([trayId]), membershipContext)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        expect(outcome.state.get(roomId)?.objectIds.has(trayId)).toBe(false)
        expect(outcome.state.get(characterId)?.objectIds.has(trayId)).toBe(true)
    })

    it('preserves the exit-edge defer from the base check', () => {
        const exitEdge: StandardExitEdgeData = { tag: 'Exit', uuid: 'edge-1', from: trayId, to: tableId, payload: {} }
        const state = buildSandboxState([
            testPositionGraphFromEnvelope(roomId, {
                nodes: [{ tag: 'Object', universalKey: trayId }],
                edges: [exitEdge],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(trayId, 'tray'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([trayId]), membershipContext)

        expect(outcome).toEqual({ verdict: 'defer', decidable: true, reason: 'exitEdge' })
    })

    it('returns illegal with incompleteTransferSet when a carry-eligible object is left out', () => {
        const glassOnTray: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: glassId, to: trayId, kind: 'On' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [glassOnTray],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(trayId, 'tray'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([trayId]), membershipContext)

        expect(outcome).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.incompleteTransferSet,
        })
        expect('state' in outcome).toBe(false)
    })

    it('is legal and recreates the internal edge on the destination host when the transfer set is complete', () => {
        const glassOnTray: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: glassId, to: trayId, kind: 'On' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [glassOnTray],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(trayId, 'tray'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([trayId, glassId]), membershipContext)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        const destinationGraph = outcome.state.get(characterId)
        expect(destinationGraph?.objectIds.has(trayId)).toBe(true)
        expect(destinationGraph?.objectIds.has(glassId)).toBe(true)
        expect(destinationGraph?.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])

        const sourceGraph = outcome.state.get(roomId)
        expect(sourceGraph?.objectIds.has(trayId)).toBe(false)
        expect(sourceGraph?.objectIds.has(glassId)).toBe(false)
        expect(sourceGraph?.relationalEdges).toEqual([])
    })

    it('returns a deterministic defer (decidable: true) for a genuine Under subject-move case', () => {
        const bootsUnderTable: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: bootsId, to: tableId, kind: 'Under' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: bootsId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [bootsUnderTable],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(bootsId, 'boots'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([bootsId]), membershipContext)

        expect(outcome).toEqual({
            verdict: 'defer',
            decidable: true,
            reason: objectManipulationErrorMessages.transferInteractionDefer,
        })
    })

    it('returns a non-decidable defer (decidable: false) for a Custom relation', () => {
        const tiedToPost: EphemeraPositionRelationalEdgeData = {
            tag: 'Relational',
            from: trayId,
            to: tableId,
            kind: 'Custom',
            relationLabel: 'tied to',
        }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [tiedToPost],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(span(trayId, 'tray'), 'takeHold')

        const outcome = applyTransferMembershipStep(state, candidate, new Set([trayId]), membershipContext)

        expect(outcome).toEqual({
            verdict: 'defer',
            decidable: false,
            reason: objectManipulationErrorMessages.transferInteractionDefer,
        })
    })
})

describe('applyRelationalStep', () => {
    it('behaves identically to validateRelationalPlanDryRun (parity) and applies the edge on legal', () => {
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                ],
                edges: [],
            }),
        ])
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(trayId, 'tray'),
            span(tableId, 'table'),
            'establishRelation',
            { type: 'enum', kind: 'On' }
        )

        const outcome = applyRelationalStep(state, candidate, roomId)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        expect(outcome.state.get(roomId)?.relationalEdges).toEqual([
            { from: trayId, to: tableId, kind: 'On' },
        ])
    })

    it('returns illegal with the same reason as evaluateRelationalLegality on conflicting topology', () => {
        const trayOnTable: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: trayId, to: tableId, kind: 'On' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [trayOnTable],
            }),
        ])
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(trayId, 'tray'),
            span(glassId, 'glass'),
            'establishRelation',
            { type: 'enum', kind: 'Under' }
        )

        const outcome = applyRelationalStep(state, candidate, roomId)

        expect(outcome).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.complexRelational,
        })
    })
})
