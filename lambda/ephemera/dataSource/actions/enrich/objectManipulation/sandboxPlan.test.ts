import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import {
    identityPlanCandidateFromSpan,
    relationalIdentityPlanCandidateFromSpans,
} from './identityPlanCandidate'
import { evaluateSandboxPlan, type SandboxPlanStep } from './sandboxPlan'
import { buildSandboxState } from './sandboxState'
import type { ObjectSpanCandidate } from './spanResolution'
import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const bookId = 'OBJECT#Book' as EphemeraObjectId

const roomSpan = (id: EphemeraObjectId, label: string): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance: 1,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
})

const heldSpan = (id: EphemeraObjectId, label: string): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance: 1,
    sourceTags: ['exact'],
    locus: { kind: 'heldByActor' },
})

const membershipContext = { sourceHostId: characterId, destinationHostId: roomId }

describe('evaluateSandboxPlan', () => {
    it('returns the initial state unchanged for an empty plan', () => {
        const state = buildSandboxState([
            testPositionGraph(roomId, { nodes: [] }),
        ])

        expect(evaluateSandboxPlan(state, [])).toEqual({ verdict: 'legal', decidable: true, state })
    })

    it('BD-8 golden path: drop then establishRelation, proving state-threading (not just looping)', () => {
        const state = buildSandboxState([
            testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] }),
            testPositionGraph(characterId, { nodes: [{ tag: 'Object', universalKey: trayId }] }),
        ])
        const steps: SandboxPlanStep[] = [
            {
                kind: 'transferMembership',
                candidate: identityPlanCandidateFromSpan(heldSpan(trayId, 'tray'), 'drop'),
                transferSet: new Set([trayId]),
                context: membershipContext,
            },
            {
                kind: 'relational',
                candidate: relationalIdentityPlanCandidateFromSpans(
                    roomSpan(trayId, 'tray'),
                    roomSpan(tableId, 'table'),
                    'establishRelation',
                    { type: 'enum', kind: 'On' }
                ),
                hostId: roomId,
            },
        ]

        const outcome = evaluateSandboxPlan(state, steps)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        expect(outcome.state.get(roomId)?.objectIds.has(trayId)).toBe(true)
        expect(outcome.state.get(roomId)?.relationalEdges).toEqual([{ from: trayId, to: tableId, kind: 'On' }])
        expect(outcome.state.get(characterId)?.objectIds.has(trayId)).toBe(false)
    })

    it('BD-9 abort: a conflicting second step aborts the whole plan with no partial state', () => {
        const glassUnderTable: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: glassId, to: tableId, kind: 'Under' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [glassUnderTable],
            }),
            testPositionGraph(characterId, { nodes: [{ tag: 'Object', universalKey: trayId }] }),
        ])
        const steps: SandboxPlanStep[] = [
            {
                kind: 'transferMembership',
                candidate: identityPlanCandidateFromSpan(heldSpan(trayId, 'tray'), 'drop'),
                transferSet: new Set([trayId]),
                context: membershipContext,
            },
            {
                kind: 'relational',
                candidate: relationalIdentityPlanCandidateFromSpans(
                    roomSpan(trayId, 'tray'),
                    roomSpan(tableId, 'table'),
                    'establishRelation',
                    { type: 'enum', kind: 'On' }
                ),
                hostId: roomId,
            },
        ]

        const outcome = evaluateSandboxPlan(state, steps)

        expect(outcome.verdict).toBe('illegal')
        expect('state' in outcome).toBe(false)
    })

    it('"get tray" as a genuine 2-step compound plan (dissolve + carry)', () => {
        const trayOnTable: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: trayId, to: tableId, kind: 'On' }
        const glassOnTray: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: glassId, to: trayId, kind: 'On' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [trayOnTable, glassOnTray],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const steps: SandboxPlanStep[] = [
            {
                kind: 'relational',
                candidate: relationalIdentityPlanCandidateFromSpans(
                    roomSpan(trayId, 'tray'),
                    roomSpan(tableId, 'table'),
                    'dissolveRelation',
                    { type: 'enum', kind: 'On' }
                ),
                hostId: roomId,
            },
            {
                kind: 'transferMembership',
                candidate: identityPlanCandidateFromSpan(roomSpan(trayId, 'tray'), 'takeHold'),
                transferSet: new Set([trayId, glassId]),
                context: { sourceHostId: roomId, destinationHostId: characterId },
            },
        ]

        const outcome = evaluateSandboxPlan(state, steps)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        const characterGraph = outcome.state.get(characterId)
        expect(characterGraph?.objectIds.has(trayId)).toBe(true)
        expect(characterGraph?.objectIds.has(glassId)).toBe(true)
        expect(characterGraph?.relationalEdges).toEqual([{ from: glassId, to: trayId, kind: 'On' }])

        const roomGraph = outcome.state.get(roomId)
        expect(roomGraph?.objectIds.has(trayId)).toBe(false)
        expect(roomGraph?.objectIds.has(glassId)).toBe(false)
        expect(roomGraph?.relationalEdges).toEqual([])
    })

    it('three-deep chain compound plan: glass on book, book on tray, tray on table, "get tray"', () => {
        const trayOnTable: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: trayId, to: tableId, kind: 'On' }
        const bookOnTray: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: bookId, to: trayId, kind: 'On' }
        const glassOnBook: EphemeraPositionRelationalEdgeData = { tag: 'Relational', from: glassId, to: bookId, kind: 'On' }
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: trayId },
                    { tag: 'Object', universalKey: tableId },
                    { tag: 'Object', universalKey: bookId },
                    { tag: 'Object', universalKey: glassId },
                ],
                edges: [trayOnTable, bookOnTray, glassOnBook],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const steps: SandboxPlanStep[] = [
            {
                kind: 'relational',
                candidate: relationalIdentityPlanCandidateFromSpans(
                    roomSpan(trayId, 'tray'),
                    roomSpan(tableId, 'table'),
                    'dissolveRelation',
                    { type: 'enum', kind: 'On' }
                ),
                hostId: roomId,
            },
            {
                kind: 'transferMembership',
                candidate: identityPlanCandidateFromSpan(roomSpan(trayId, 'tray'), 'takeHold'),
                transferSet: new Set([trayId, bookId, glassId]),
                context: { sourceHostId: roomId, destinationHostId: characterId },
            },
        ]

        const outcome = evaluateSandboxPlan(state, steps)

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') {
            throw new Error('expected legal')
        }
        const characterGraph = outcome.state.get(characterId)
        expect(characterGraph?.objectIds).toEqual(new Set([trayId, bookId, glassId]))
        expect(characterGraph?.relationalEdges).toEqual(
            expect.arrayContaining([
                { from: bookId, to: trayId, kind: 'On' },
                { from: glassId, to: bookId, kind: 'On' },
            ])
        )
        expect(characterGraph?.relationalEdges).toHaveLength(2)

        const roomGraph = outcome.state.get(roomId)
        expect(roomGraph?.objectIds.has(trayId)).toBe(false)
        expect(roomGraph?.objectIds.has(bookId)).toBe(false)
        expect(roomGraph?.objectIds.has(glassId)).toBe(false)
        expect(roomGraph?.relationalEdges).toEqual([])
    })
})
