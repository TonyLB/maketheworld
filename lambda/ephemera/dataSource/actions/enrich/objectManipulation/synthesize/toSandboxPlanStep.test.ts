import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../../../../positions/positionGraph/testFixtures'
import { actingCharacterRef, currentHostRef, objectSpanRef } from '../plan/ungroundedPrimitive'
import type { Change } from '../plan/ungroundedPrimitive'
import type { DissolveRelationStep, EstablishRelationStep, TransferMembershipStep } from '../parsePlanStep'
import { groundChange } from './groundChange'
import { expandTransferMembership } from './expandTransferMembership'
import { evaluateSandboxPlan } from '../sandboxPlan'
import { buildSandboxState } from '../sandboxState'
import { relationalStepToSandboxPlanStep, transferMembershipToSandboxPlanStep } from './toSandboxPlanStep'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
const OTHER_CHARACTER_ID = 'CHARACTER#Beta' as EphemeraCharacterId

describe('relationalStepToSandboxPlanStep', () => {
    it('converts an EstablishRelationStep with an enum relationKind', () => {
        const step: EstablishRelationStep = {
            kind: 'establishRelation',
            subjectId: TRAY_ID,
            targetId: TABLE_ID,
            relationKind: 'On',
            hostRoomId: ROOM_ID,
        }

        const result = relationalStepToSandboxPlanStep(step)

        expect(result.ok).toBe(true)
        if (result.ok && result.step.kind === 'relational') {
            expect(result.step.hostId).toBe(ROOM_ID)
            expect(result.step.candidate.subject.objectId).toBe(TRAY_ID)
            expect(result.step.candidate.target.objectId).toBe(TABLE_ID)
            expect(result.step.candidate.plan.relation).toEqual({ type: 'enum', kind: 'On' })
        }
    })

    it('converts a DissolveRelationStep with a Custom relationKind + relationLabel', () => {
        const step: DissolveRelationStep = {
            kind: 'dissolveRelation',
            subjectId: TRAY_ID,
            targetId: TABLE_ID,
            relationKind: 'Custom',
            relationLabel: 'wedged against',
            hostRoomId: ROOM_ID,
        }

        const result = relationalStepToSandboxPlanStep(step)

        expect(result.ok).toBe(true)
        if (result.ok && result.step.kind === 'relational') {
            expect(result.step.candidate.plan.relation).toEqual({
                type: 'custom',
                kind: 'Custom',
                relationLabel: 'wedged against',
            })
        }
    })
})

describe('transferMembershipToSandboxPlanStep', () => {
    const stepWith = (fromHostId: TransferMembershipStep['fromHostId'], toHostId: TransferMembershipStep['toHostId']): TransferMembershipStep => ({
        kind: 'transferMembership',
        objectIds: new Set([TRAY_ID, GLASS_ID]),
        fromHostId,
        toHostId,
    })

    it('derives locus room and operationKind takeHold for a Room -> Character transfer', () => {
        const result = transferMembershipToSandboxPlanStep(TRAY_ID, stepWith(ROOM_ID, CHARACTER_ID), CHARACTER_ID)

        expect(result.ok).toBe(true)
        if (result.ok && result.step.kind === 'transferMembership') {
            expect(result.step.candidate.identity.locus).toEqual({ kind: 'room' })
            expect(result.step.candidate.plan.operationKind).toBe('takeHold')
            expect(result.step.transferSet).toEqual(new Set([TRAY_ID, GLASS_ID]))
            expect(result.step.context).toEqual({ sourceHostId: ROOM_ID, destinationHostId: CHARACTER_ID })
        }
    })

    it('derives locus heldByActor and operationKind drop for a Character (acting) -> Room transfer', () => {
        const result = transferMembershipToSandboxPlanStep(TRAY_ID, stepWith(CHARACTER_ID, ROOM_ID), CHARACTER_ID)

        expect(result.ok).toBe(true)
        if (result.ok && result.step.kind === 'transferMembership') {
            expect(result.step.candidate.identity.locus).toEqual({ kind: 'heldByActor' })
            expect(result.step.candidate.plan.operationKind).toBe('drop')
        }
    })

    it('derives locus heldByOtherCharacter for a non-acting Character source', () => {
        const result = transferMembershipToSandboxPlanStep(TRAY_ID, stepWith(OTHER_CHARACTER_ID, ROOM_ID), CHARACTER_ID)

        expect(result.ok).toBe(true)
        if (result.ok && result.step.kind === 'transferMembership') {
            expect(result.step.candidate.identity.locus).toMatchObject({
                kind: 'heldByOtherCharacter',
                characterId: OTHER_CHARACTER_ID,
            })
        }
    })

    it('fails to derive operationKind for a Character -> Character transfer', () => {
        const result = transferMembershipToSandboxPlanStep(TRAY_ID, stepWith(OTHER_CHARACTER_ID, CHARACTER_ID), CHARACTER_ID)

        expect(result.ok).toBe(false)
    })
})

describe('end-to-end: Grounding -> Expansion -> reconciliation -> Validation (BD-13 worked example)', () => {
    it('grounds, closes, and validates "get tray" with glass On tray, tray On table', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('tray'),
            from: currentHostRef(objectSpanRef('tray')),
            to: actingCharacterRef,
        }

        const groundResult = groundChange(change, {
            actingCharacterId: CHARACTER_ID,
            resolvedSpans: new Map([['tray', { verdict: 'resolved', objectId: TRAY_ID }]]),
            getCurrentHost: (componentId) => (componentId === TRAY_ID ? ROOM_ID : undefined),
        })
        expect(groundResult.ok).toBe(true)
        if (!groundResult.ok) return

        const roomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [
                { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
            ],
        })
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })

        const expandResult = expandTransferMembership(
            groundResult.step as TransferMembershipStep,
            (hostId) => (hostId === ROOM_ID ? roomGraph : undefined)
        )
        expect(expandResult.verdict).toBe('complete')
        if (expandResult.verdict !== 'complete') return
        expect(expandResult.dissolveSteps).toHaveLength(1)

        const dissolveSandboxStep = relationalStepToSandboxPlanStep(expandResult.dissolveSteps[0])
        const transferSandboxStep = transferMembershipToSandboxPlanStep(
            TRAY_ID,
            expandResult.transferStep,
            CHARACTER_ID
        )
        expect(dissolveSandboxStep.ok).toBe(true)
        expect(transferSandboxStep.ok).toBe(true)
        if (!dissolveSandboxStep.ok || !transferSandboxStep.ok) return

        const initialState = buildSandboxState([roomGraph, characterGraph])
        const outcome = evaluateSandboxPlan(initialState, [dissolveSandboxStep.step, transferSandboxStep.step])

        expect(outcome.verdict).toBe('legal')
        if (outcome.verdict !== 'legal') return

        const finalRoomGraph = outcome.state.get(ROOM_ID)
        const finalCharacterGraph = outcome.state.get(CHARACTER_ID)
        expect(finalRoomGraph?.objectIds.has(TRAY_ID)).toBe(false)
        expect(finalRoomGraph?.objectIds.has(GLASS_ID)).toBe(false)
        expect(finalRoomGraph?.objectIds.has(TABLE_ID)).toBe(true)
        expect(finalCharacterGraph?.objectIds.has(TRAY_ID)).toBe(true)
        expect(finalCharacterGraph?.objectIds.has(GLASS_ID)).toBe(true)
        expect(finalCharacterGraph?.relationalEdges).toEqual([
            { from: GLASS_ID, to: TRAY_ID, kind: 'On' },
        ])
    })
})
