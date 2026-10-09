import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { attemptReferentAnswers, attemptSpanKeys, expandAndAdjudicateCandidates, proposeAttemptCandidates } from './attemptCandidates'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { planSkeleton } from './plan/planSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'
import { CommandAttempt } from '../../commandAttempt'
import type { NarrationUnit } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { actingCharacterRef, currentHostRef } from './plan/planStep'

const cupId = 'OBJECT#Cup' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: cupId, normalizedShortName: 'cup', catalogScope: 'room' },
    { objectId: trayId, normalizedShortName: 'tray', catalogScope: 'room' },
]

const pool = (span: string, id: EphemeraObjectId): SpanCandidatePool => ({
    span,
    candidates: [{ id, label: span, jointRelevance: 1, sourceTags: ['exact'], locus: { kind: 'room' } }],
})

const attemptFor = (skeleton: ParseSkeleton, command: string): CommandAttempt => {
    const plan = planSkeleton(skeleton, command)
    if (plan.type !== 'attempts') {
        throw new Error(`Plan declined "${command}"`)
    }
    return plan.attempts[0]!
}

const relationSkeleton: ParseSkeleton = [
    { type: 'text', text: 'put' },
    { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
    { type: 'text', text: 'on' },
    { type: 'objectSpan', span: 'tray', stableRefKey: 'trayRef' },
]

describe('attemptSpanKeys', () => {
    it('lists the distinct stableRefKeys the attempt names, in order', () => {
        expect(attemptSpanKeys([attemptFor(relationSkeleton, 'put cup on tray')])).toEqual(['cupRef', 'trayRef'])
    })
})

describe('proposeAttemptCandidates', () => {
    it('grounds the step and describes it, keeping today\'s Consult wording', () => {
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates).toHaveLength(1)
        const [candidate] = result.candidates
        expect(candidate.alternative).toEqual({ label: 'cup / tray', proposedCommand: 'put the cup on the tray' })
        expect(attemptReferentAnswers(candidate.attempt)).toEqual({ cupRef: cupId, trayRef: trayId })
        const [action] = candidate.attempt.actions()
        expect(action.describe()).toBe('Put cup on tray')
        expect(action.referents()).toEqual([
            expect.objectContaining({ referentType: 'objectSpan', groundedId: cupId, shortName: 'cup' }),
            expect.objectContaining({ referentType: 'currentHost' }),
            expect.objectContaining({ referentType: 'objectSpan', groundedId: trayId, shortName: 'tray' }),
        ])
    })

    it('keeps the Plan action\'s id on every identity candidate grounded from it', () => {
        const otherCupId = 'OBJECT#OtherCup' as EphemeraObjectId
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const twoCups: SpanCandidatePool = {
            span: 'cup',
            candidates: [cupId, otherCupId].map((id) => ({ id, label: 'cup', jointRelevance: 1, sourceTags: ['exact' as const], locus: { kind: 'room' as const } })),
        }
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', twoCups], ['trayRef', pool('tray', trayId)]]),
            catalog: [...catalog, { objectId: otherCupId, normalizedShortName: 'cup', catalogScope: 'room' }],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates).toHaveLength(2)
        const [planAction] = attempt.actions()
        expect(result.candidates.map((candidate) => candidate.attempt.actions()[0]?.id)).toEqual([planAction.id, planAction.id])
    })

    it('stamps each identity candidate\'s span with the presence its own catalog entry was seen in', () => {
        const otherCupId = 'OBJECT#OtherCup' as EphemeraObjectId
        const roomId = 'ROOM#Kitchen' as EphemeraRoomId
        const shelfBinding = 'PRESENCE#shelf-in-kitchen' as EphemeraPresenceNodeId
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const twoCups: SpanCandidatePool = {
            span: 'cup',
            candidates: [cupId, otherCupId].map((id) => ({ id, label: 'cup', jointRelevance: 1, sourceTags: ['exact' as const], locus: { kind: 'room' as const } })),
        }
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', twoCups], ['trayRef', pool('tray', trayId)]]),
            catalog: [
                { objectId: cupId, normalizedShortName: 'cup', catalogScope: 'room', presence: [roomId] },
                { objectId: otherCupId, normalizedShortName: 'cup', catalogScope: 'room', presence: [{ host: 'OBJECT#Shelf' as EphemeraObjectId, presence: shelfBinding }] },
                { objectId: trayId, normalizedShortName: 'tray', catalogScope: 'room' },
            ],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        const cupSpans = result.candidates.map((candidate) => candidate.attempt.actions()[0]?.referents()[0])
        expect(cupSpans).toEqual(expect.arrayContaining([
            expect.objectContaining({ groundedId: cupId, groundedPresence: [roomId] }),
            expect.objectContaining({ groundedId: otherCupId, groundedPresence: [{ host: 'OBJECT#Shelf' as EphemeraObjectId, presence: shelfBinding }] }),
        ]))
        const traySpan = result.candidates[0]?.attempt.actions()[0]?.referents()[2]
        expect(traySpan).toEqual(expect.objectContaining({ groundedId: trayId }))
        expect(traySpan).not.toHaveProperty('groundedPresence')
    })

    it('never binds two distinct span keys of one step to the same object', () => {
        const sameObject = attemptFor([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef2' },
        ], 'put cup on cup')

        const result = proposeAttemptCandidates({
            command: 'put cup on cup',
            attempts: [sameObject],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['cupRef2', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'no pairing',
        })

        expect(result).toEqual({ ok: false, reason: 'no pairing' })
    })

    it('builds each candidate from its own attempt, so two attempts sharing a span key never pool their actions', () => {
        // No real skeleton yields two attempts today (the templates are disjoint), so the pair is hand-built.
        const putOnTray = attemptFor(relationSkeleton, 'put cup on tray')
        const takeCup = attemptFor([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        ], 'take cup')

        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [putOnTray, takeCup],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        // One assignment (cupRef and trayRef each have one candidate), one candidate per attempt.
        expect(result.candidates.map((candidate) => candidate.attempt.actions().map((action) => action.describe()))).toEqual([
            ['Put cup on tray'],
            ['Take: cup'],
        ])
        expect(result.candidates.map((candidate) => candidate.alternative)).toEqual([
            { label: 'cup / tray', proposedCommand: 'put the cup on the tray' },
            { objectId: cupId, label: 'cup', proposedCommand: 'take the cup' },
        ])
    })

    it('reads the joint assignment off each grounded attempt, one key per span', () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attemptFor(relationSkeleton, 'put cup on tray')],
            spanPools: new Map([
                ['cupRef', { ...pool('cup', cupId), candidates: [pool('cup', cupId).candidates[0]!, pool('cup', secondCupId).candidates[0]!] }],
                ['trayRef', pool('tray', trayId)],
            ]),
            catalog: [...catalog, { objectId: secondCupId, normalizedShortName: 'cup', catalogScope: 'room' }],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates.map((candidate) => attemptReferentAnswers(candidate.attempt))).toEqual([
            { cupRef: cupId, trayRef: trayId },
            { cupRef: secondCupId, trayRef: trayId },
        ])
    })

    it('abstains with the keyed-pool wording when a referent has no pool', () => {
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attemptFor(relationSkeleton, 'put cup on tray')],
            spanPools: new Map([['cupRef', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result).toEqual({ ok: false, reason: 'No resolution supplied for stableRefKey "trayRef"' })
    })
})

describe('describe-only (look) grounding', () => {
    it('names the look by its grounded referent and keeps "Look at the" wording', () => {
        const look = attemptFor([
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        ], 'look cup')

        const result = proposeAttemptCandidates({
            command: 'look cup',
            attempts: [look],
            spanPools: new Map([['cupRef', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        const [candidate] = result.candidates
        expect(candidate.alternative).toEqual({ objectId: cupId, label: 'cup', proposedCommand: 'look at the cup' })
        expect(candidate.attempt.actions()[0].describe()).toBe('Look at the cup')
        expect(candidate.attempt.actions()[0].referents()).toEqual([
            expect.objectContaining({ groundedId: cupId, shortName: 'cup' }),
        ])
    })

})

describe('narration units through candidate building and Expansion', () => {
    const authoredUnit = (actionId: string): NarrationUnit => ({
        covers: [actionId],
        variants: [{ audience: { refs: ['cupRef'], phase: 'before' }, parts: [{ slot: 'actor' }, { text: ' moves ' }, { ref: 'cupRef' }] }],
    })

    it('keeps the Plan attempt\'s own narration units on every grounded candidate', () => {
        const planned = attemptFor(relationSkeleton, 'put cup on tray')
        const unit = authoredUnit(planned.actions()[0]!.id)
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [CommandAttempt.create(planned.words, planned.actions(), [unit])],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates[0]?.attempt.narrationUnits()).toEqual([unit])
    })

    it('adds Expansion\'s dissolve units beside the attempt\'s own, rather than replacing them', () => {
        const roomId = 'ROOM#Bridge' as EphemeraRoomId
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const postId = 'OBJECT#Post' as EphemeraObjectId
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const take = new PositionAttemptAction('take', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ropeId },
            from: currentHostRef({ referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' }),
            to: actingCharacterRef,
        }, 'Take: rope')
        const unit = authoredUnit('take')

        const [expanded] = expandAndAdjudicateCandidates(
            [{ attempt: CommandAttempt.create('take rope', [take], [unit]), confidence: 1, alternative: { label: 'rope', proposedCommand: 'take the rope' } }],
            {
                getGraph: (hostId) => (hostId === roomId ? graph : undefined),
                getCurrentHost: (id) => (id === ropeId ? roomId : undefined),
                getMembershipContainers: () => [],
            }
        )

        const [dissolve] = expanded!.attempt.actions()
        expect(expanded!.attempt.narrationUnits()).toEqual([
            unit,
            expect.objectContaining({ covers: [dissolve!.id] }),
        ])
    })
})
