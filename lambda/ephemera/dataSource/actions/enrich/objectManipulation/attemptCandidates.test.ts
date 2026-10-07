import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { attemptSpanKeys, proposeAttemptCandidates } from './attemptCandidates'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { planSkeleton } from './plan/planSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'
import type { CommandAttempt } from '../../commandAttempt'

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
