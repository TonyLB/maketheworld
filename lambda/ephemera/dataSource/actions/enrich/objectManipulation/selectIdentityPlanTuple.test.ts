import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { identityPlanCandidateFromSpan } from './identityPlanCandidate'
import { T_JOINT_ABS, T_JOINT_ABS_UNARY, T_JOINT_MARGIN } from './embeddingMatch/thresholds'
import { selectIdentityPlanTuple } from './selectIdentityPlanTuple'
import type { ObjectSpanCandidate } from './spanResolution'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { buildSandboxState } from './sandboxState'
import { testPositionGraph, testPositionGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId

const candidate = (
    id: EphemeraObjectId,
    label: string,
    jointRelevance: number,
    locus: ObjectSpanCandidate['locus'],
    marginToRunnerUp?: number
): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance,
    marginToRunnerUp,
    sourceTags: ['lexical', 'embedding'],
    locus,
})

const roomGraph = testPositionGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: bagId },
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: mopId },
        { tag: 'Object' as const, universalKey: anvilId },
        { tag: 'Object' as const, universalKey: trayId },
        { tag: 'Object' as const, universalKey: glassId },
    ],
})
const characterGraph = testPositionGraph(characterId, {
    nodes: [{ tag: 'Object' as const, universalKey: satchelId }],
})
const sandboxState = buildSandboxState([roomGraph, characterGraph])

const withSandbox = (input: Parameters<typeof selectIdentityPlanTuple>[0]) =>
    selectIdentityPlanTuple({ ...input, sandboxState, roomId, actorCharacterId: characterId })

describe('selectIdentityPlanTuple', () => {
    it('illegal-if-wrong: drop bag selects held satchel over room bag', () => {
        const roomBag = identityPlanCandidateFromSpan(
            candidate(bagId, 'bag', 0.7, { kind: 'room' }),
            'drop'
        )
        const heldSatchel = identityPlanCandidateFromSpan(
            candidate(satchelId, 'satchel', 0.55, { kind: 'heldByActor' }),
            'drop'
        )

        const result = withSandbox({
            candidates: [roomBag, heldSatchel],
            commandSpan: 'bag',
        })

        expect(result.verdict).toBe('resolved')
        if (result.verdict === 'resolved') {
            expect(result.candidate.identity.objectId).toBe(satchelId)
            expect(result.candidate.plan.operationKind).toBe('drop')
        }
    })

    it('thin margin among legal survivors -> consult', () => {
        const broom = identityPlanCandidateFromSpan(
            candidate(broomId, 'broom', T_JOINT_ABS + 0.05, { kind: 'room' }, T_JOINT_MARGIN - 0.01),
            'takeHold'
        )
        const mop = identityPlanCandidateFromSpan(
            candidate(mopId, 'mop', T_JOINT_ABS + 0.02, { kind: 'room' }),
            'takeHold'
        )

        const result = withSandbox({
            candidates: [broom, mop],
            commandSpan: 'sweeping tool',
        })

        expect(result.verdict).toBe('consult')
        if (result.verdict === 'consult') {
            expect(result.alternatives).toHaveLength(2)
            expect(result.alternatives.map((a) => a.objectId)).toEqual([broomId, mopId])
        }
    })

    it('absent-object grey band below floor -> abstain (not consult)', () => {
        const anvil = identityPlanCandidateFromSpan(
            candidate(
                anvilId,
                'anvil',
                T_JOINT_ABS - 0.05,
                { kind: 'room' }
            ),
            'takeHold'
        )

        const result = withSandbox({
            candidates: [anvil],
            commandSpan: 'sword',
        })

        expect(result).toEqual({
            verdict: 'abstain',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })

    it('auto-resolves exact / high-margin unary above unary floor', () => {
        const broom = identityPlanCandidateFromSpan(
            candidate(broomId, 'broom', 1, { kind: 'room' }),
            'takeHold'
        )
        broom.identity = { ...broom.identity, sourceTags: ['exact'] }

        const result = withSandbox({ candidates: [broom] })
        expect(result.verdict).toBe('resolved')
    })

    it('uses unary absolute floor for single legal survivor', () => {
        const below = withSandbox({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', T_JOINT_ABS_UNARY - 0.01, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })
        expect(below.verdict).toBe('abstain')

        const above = withSandbox({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', T_JOINT_ABS_UNARY, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })
        expect(above.verdict).toBe('resolved')
    })

    it('returns illegal reason when all candidates illegal', () => {
        const result = withSandbox({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 0.9, { kind: 'room' }),
                    'drop'
                ),
            ],
        })
        expect(result).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.notCarryingObject,
        })
    })

    it('returns illegal reason when no graph state is supplied at all (roomId/actorCharacterId absent)', () => {
        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 0.9, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })
        expect(result).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noMembershipHost,
        })
    })

    it('defers (not resolved) when the object touches an exit edge (Slice 4b: now decided during selection)', () => {
        const roomGraphWithExit = testPositionGraphFromEnvelope(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: broomId }],
            edges: [{ tag: 'Exit', uuid: 'edge-1', from: broomId, to: 'OBJECT#Table' as EphemeraObjectId, payload: {} }],
        })
        const stateWithExit = buildSandboxState([roomGraphWithExit, characterGraph])

        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
            sandboxState: stateWithExit,
            roomId,
            actorCharacterId: characterId,
        })

        expect(result.verdict).toBe('defer')
    })

    it('Slice 3: a carry-related object (glass On tray) computes the real closure via Expansion and resolves with the full transfer set', () => {
        const roomGraphWithCarry = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: trayId },
                { tag: 'Object' as const, universalKey: glassId },
            ],
            edges: [{ tag: 'Relational', from: glassId, to: trayId, kind: 'On' }],
        })
        const stateWithCarry = buildSandboxState([roomGraphWithCarry, characterGraph])

        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(trayId, 'tray', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
            sandboxState: stateWithCarry,
            roomId,
            actorCharacterId: characterId,
        })

        expect(result.verdict).toBe('resolved')
        if (result.verdict !== 'resolved') return
        expect(result.dryRun.objectIds).toEqual([trayId, glassId])
    })

    it('Slice 3: BD-13\'s own "get tray" shape (glass On tray, tray On table) also computes the full closure + dissolve, and resolves', () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const roomGraphWithCarryAndDissolve = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: trayId },
                { tag: 'Object' as const, universalKey: glassId },
                { tag: 'Object' as const, universalKey: tableId },
            ],
            edges: [
                { tag: 'Relational', from: glassId, to: trayId, kind: 'On' },
                { tag: 'Relational', from: trayId, to: tableId, kind: 'On' },
            ],
        })
        const stateWithBoth = buildSandboxState([roomGraphWithCarryAndDissolve, characterGraph])

        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(trayId, 'tray', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
            sandboxState: stateWithBoth,
            roomId,
            actorCharacterId: characterId,
        })

        expect(result.verdict).toBe('resolved')
        if (result.verdict !== 'resolved') return
        expect(result.dryRun.objectIds).toEqual([trayId, glassId])
    })

    it('Slice 2: an object with no boundary relational edges stays legal, unchanged (no regression)', () => {
        const result = withSandbox({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })

        expect(result.verdict).toBe('resolved')
    })

    it('Slice 2: an Against-classified boundary edge still cleanly dissolves (no carry, no dissolve-apply needed), stays legal', () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const roomGraphWithAgainst = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: broomId },
                { tag: 'Object' as const, universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: broomId, to: tableId, kind: 'Against' }],
        })
        const stateWithAgainst = buildSandboxState([roomGraphWithAgainst, characterGraph])

        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
            sandboxState: stateWithAgainst,
            roomId,
            actorCharacterId: characterId,
        })

        expect(result.verdict).toBe('resolved')
    })

    it('Slice 2: a Custom-kind boundary edge still defers (unchanged shape, now reachable via real classification)', () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const roomGraphWithCustom = testPositionGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: broomId },
                { tag: 'Object' as const, universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: broomId, to: tableId, kind: 'Custom', relationLabel: 'tied to' }],
        })
        const stateWithCustom = buildSandboxState([roomGraphWithCustom, characterGraph])

        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 1, { kind: 'room' }),
                    'takeHold'
                ),
            ],
            sandboxState: stateWithCustom,
            roomId,
            actorCharacterId: characterId,
        })

        expect(result.verdict).toBe('defer')
    })
})
