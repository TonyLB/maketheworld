import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { identityPlanCandidateFromSpan } from './identityPlanCandidate'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { evaluateSandboxPlan } from './sandboxPlan'
import { buildSandboxState, type SandboxState } from './sandboxState'
import type { DryRunOutcome } from './validatePlanDryRun'
import type { TransferMembershipStepContext } from './sandboxStep'
import { selectPlanTuple } from './selectIdentityPlanTuple'
import type { SpanResolutionConsultAlternative } from './spanResolution'
import type { ObjectSpanCandidate } from './spanResolution'
import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const glassId = 'OBJECT#Glass' as EphemeraObjectId
const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId

const roomSpan = (id: EphemeraObjectId, label: string, jointRelevance: number): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
})

const membershipContext: TransferMembershipStepContext = { sourceHostId: roomId, destinationHostId: characterId }

/**
 * TEST-ONLY adapter proving `evaluateSandboxPlan`'s output slots into the
 * real, unmodified `selectPlanTuple` core as a `dryRun` callback --- not a
 * production adapter. Production wiring (`selectIdentityPlanTuple.ts:167`,
 * `selectMembershipFromPool.ts`) is deferred to C1 (see sandbox planning doc).
 */
const dryRunFromSandbox = (state: SandboxState) =>
    (candidate: IdentityPlanCandidate): DryRunOutcome => {
        const outcome = evaluateSandboxPlan(state, [
            {
                kind: 'transferMembership',
                candidate,
                transferSet: new Set([candidate.identity.objectId]),
                context: membershipContext,
            },
        ])
        return outcome.verdict === 'legal'
            ? { verdict: 'legal', decidable: true }
            : { verdict: outcome.verdict, decidable: outcome.decidable, reason: outcome.reason }
    }

const toConsultAlternative = (candidate: IdentityPlanCandidate): SpanResolutionConsultAlternative => ({
    objectId: candidate.identity.objectId,
    label: candidate.identity.label,
    proposedCommand: `take the ${candidate.identity.label}`,
})

describe('sandbox output through the real (unmodified) selectPlanTuple core', () => {
    it('resolves a single legal candidate', () => {
        const state = buildSandboxState([
            testPositionGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const candidate = identityPlanCandidateFromSpan(roomSpan(trayId, 'tray', 0.9), 'takeHold')

        const result = selectPlanTuple({
            candidates: [candidate],
            getConfidence: (c) => c.confidence,
            dryRun: dryRunFromSandbox(state),
            toConsultAlternative,
        })

        expect(result).toEqual({
            verdict: 'resolved',
            candidate,
            dryRun: { verdict: 'legal', decidable: true },
            legalSurvivors: [{ candidate, dryRun: { verdict: 'legal', decidable: true } }],
        })
    })

    it('consults on two legal candidates with a thin confidence margin', () => {
        const state = buildSandboxState([
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: bagId },
                    { tag: 'Object', universalKey: satchelId },
                ],
            }),
            testPositionGraph(characterId, { nodes: [] }),
        ])
        const bag = identityPlanCandidateFromSpan(roomSpan(bagId, 'bag', 0.6), 'takeHold')
        const satchel = identityPlanCandidateFromSpan(roomSpan(satchelId, 'satchel', 0.55), 'takeHold')

        const result = selectPlanTuple({
            candidates: [bag, satchel],
            getConfidence: (c) => c.confidence,
            dryRun: dryRunFromSandbox(state),
            toConsultAlternative,
        })

        expect(result.verdict).toBe('consult')
        if (result.verdict !== 'consult') {
            throw new Error('expected consult')
        }
        expect(result.alternatives).toEqual([
            { objectId: bagId, label: 'bag', proposedCommand: 'take the bag' },
            { objectId: satchelId, label: 'satchel', proposedCommand: 'take the satchel' },
        ])
    })

    it('surfaces a sandbox-specific illegal reason (incompleteTransferSet) through the unmodified selector', () => {
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
        const candidate = identityPlanCandidateFromSpan(roomSpan(trayId, 'tray', 0.9), 'takeHold')

        const result = selectPlanTuple({
            candidates: [candidate],
            getConfidence: (c) => c.confidence,
            dryRun: dryRunFromSandbox(state),
            toConsultAlternative,
        })

        expect(result).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.incompleteTransferSet,
        })
    })
})
