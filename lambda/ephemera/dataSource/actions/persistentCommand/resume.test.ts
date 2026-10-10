import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../positions/ludicGraph/testFixtures'
import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import { planSkeleton } from '../enrich/objectManipulation/plan/planSkeleton'
import { resumeErrorMessages, primaryActionIdOf } from '../enrich/objectManipulation/resumeAnswers'
import { CommandAttempt } from '../commandAttempt'
import type { PersistentCommandPayload } from './payload'
import { resumePersistentCommand } from './resume'
import { transcriptContextForResume } from './transcript'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const cupId = 'OBJECT#Cup' as EphemeraObjectId
const redCupId = 'OBJECT#RedCup' as EphemeraObjectId
const blueCupId = 'OBJECT#BlueCup' as EphemeraObjectId
const doorId = 'OBJECT#Door' as EphemeraObjectId

const skeleton = stampStableRefKeys([
    { type: 'text', text: 'take' },
    { type: 'objectSpan', span: 'cup' },
])
const cupKey = (skeleton[1] as { stableRefKey: string }).stableRefKey
const planned = planSkeleton(skeleton, 'take cup').attempts
const primaryId = primaryActionIdOf(planned[0]!)!

const rowOf = (overrides: Partial<PersistentCommandPayload> = {}): PersistentCommandPayload => ({
    root: { command: 'take cup', skeleton, attempts: planned.map((attempt) => attempt.toJSON()), confidence: 0.9 },
    referentAnswers: {},
    challengeAnswers: {},
    ...overrides,
})

const characterId = 'CHARACTER#Tess' as EphemeraCharacterId

/** A room holding `objectIds`; with `touchedId`, a navigation edge touches that object, so taking it raises an exit challenge. */
const readsFor = (objectIds: EphemeraObjectId[], touchedId?: EphemeraObjectId) => ({
    getMembershipContainers: jest.fn().mockImplementation(async (id: string) => (id === characterId ? [] : [roomId])),
    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => (hostId === roomId
        ? testLudicGraphFromEnvelope(roomId, {
            nodes: objectIds.map((universalKey) => ({ tag: 'Object' as const, universalKey })),
            edges: touchedId === undefined ? [] : [{ kind: 'Navigation', uuid: 'edge-1', from: touchedId, to: doorId, payload: {} }],
        })
        : testLudicGraph(hostId as EphemeraRoomId))),
})

const world = (catalogIds: EphemeraObjectId[]) => ({
    characterId,
    hostRoomId: roomId,
    roomObjectCatalog: catalogIds.map((objectId) => ({ objectId, normalizedShortName: 'cup' })),
})

describe('resumePersistentCommand', () => {
    it('reruns the frozen root against the world as it is now', async () => {
        const result = await resumePersistentCommand(rowOf(), world([cupId]), { positionsReadDeps: readsFor([cupId]) })

        expect(result).toMatchObject({ type: 'CommandAttempt', confidence: 0.9 })
    })

    it('a referent answer narrows two cups to the chosen one, where an unanswered row consults', async () => {
        const catalog = world([redCupId, blueCupId])

        const unanswered = await resumePersistentCommand(rowOf(), catalog, { positionsReadDeps: readsFor([redCupId, blueCupId]) })
        const answered = await resumePersistentCommand(
            rowOf({ referentAnswers: { [cupKey]: blueCupId } }),
            catalog,
            { positionsReadDeps: readsFor([redCupId, blueCupId]) }
        )

        expect(unanswered.type).toBe('Consult')
        expect(answered).toMatchObject({ type: 'CommandAttempt' })
        const [action] = (answered as any).attempt.actions
        expect(action.desiredResult.object.groundedId).toBe(blueCupId)
    })

    it.each([[0, redCupId], [1, blueCupId]])('a Consult\'s own root and option %i resume to that option\'s cup', async (index, expectedId) => {
        const catalog = world([redCupId, blueCupId])
        const consult = await resumePersistentCommand(rowOf(), catalog, { positionsReadDeps: readsFor([redCupId, blueCupId]) })
        if (consult.type !== 'Consult' || consult.root === undefined) {
            throw new Error('expected a Consult carrying its root')
        }

        const answered = await resumePersistentCommand(
            { root: consult.root, referentAnswers: consult.alternatives[index]!.referentAnswers!, challengeAnswers: {} },
            catalog,
            { positionsReadDeps: readsFor([redCupId, blueCupId]) }
        )

        expect(answered).toMatchObject({ type: 'CommandAttempt' })
        expect((answered as any).attempt.actions[0].desiredResult.object.groundedId).toBe(expectedId)
    })

    it('refuses a referent answer whose thing is no longer in the pool', async () => {
        const result = await resumePersistentCommand(
            rowOf({ referentAnswers: { [cupKey]: redCupId } }),
            world([blueCupId]),
            { positionsReadDeps: readsFor([blueCupId]) }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: resumeErrorMessages.staleReferentAnswer('cup') })
    })

    it('ignores a referent answer for a key no attempt names', async () => {
        const result = await resumePersistentCommand(
            rowOf({ referentAnswers: { somethingElse: redCupId } }),
            world([cupId]),
            { positionsReadDeps: readsFor([cupId]) }
        )

        expect(result).toMatchObject({ type: 'CommandAttempt' })
    })

    it('narrows the frozen attempts to the selected one', async () => {
        const sibling = CommandAttempt.create('take cup', planned[0]!.actions().map((action) => action.withChallenges([])), [])
        const siblingData = { ...sibling.toJSON(), actions: sibling.toJSON().actions.map((action) => ({ ...action, id: 'sibling-primary' })) }
        const row = rowOf()
        const both = { ...row, root: { ...row.root, attempts: [...row.root.attempts, siblingData] } }

        const selected = await resumePersistentCommand({ ...both, selectedAttempt: primaryId }, world([cupId]), { positionsReadDeps: readsFor([cupId]) })
        const stale = await resumePersistentCommand({ ...both, selectedAttempt: 'gone' }, world([cupId]), { positionsReadDeps: readsFor([cupId]) })

        expect(selected).toMatchObject({ type: 'CommandAttempt' })
        expect(stale).toEqual({ type: 'Error', errorMessage: resumeErrorMessages.staleSelectedAttempt })
    })

    describe('challenge answers', () => {
        const exitKey = `exitEdge:${primaryId}`

        it('leaves an exit contact pending (the command abstains) without an answer', async () => {
            const result = await resumePersistentCommand(rowOf(), world([cupId]), { positionsReadDeps: readsFor([cupId], cupId) })

            expect(result.type).toBe('Abstain')
        })

        it('turns a stored met answer into that challenge\'s verdict', async () => {
            const result = await resumePersistentCommand(
                rowOf({ challengeAnswers: { [exitKey]: { verdict: { kind: 'met' }, source: 'player' } } }),
                world([cupId]),
                { positionsReadDeps: readsFor([cupId], cupId) }
            )

            expect(result).toMatchObject({ type: 'CommandAttempt' })
        })

        it('a stored impossible answer refuses the attempt', async () => {
            const result = await resumePersistentCommand(
                rowOf({ challengeAnswers: { [exitKey]: { verdict: { kind: 'impossible', reason: 'bolted down' }, source: 'process' } } }),
                world([cupId]),
                { positionsReadDeps: readsFor([cupId], cupId) }
            )

            expect(result).toEqual({ type: 'Error', errorMessage: 'bolted down' })
        })

        it('ignores an answer whose challenge the fresh run did not regenerate', async () => {
            const result = await resumePersistentCommand(
                rowOf({ challengeAnswers: { [exitKey]: { verdict: { kind: 'impossible', reason: 'bolted down' }, source: 'player' } } }),
                world([cupId]),
                { positionsReadDeps: readsFor([cupId]) }
            )

            expect(result).toMatchObject({ type: 'CommandAttempt' })
        })

        it('an askedAs entry re-adds its question as a pending challenge, so the command still waits', async () => {
            const result = await resumePersistentCommand(
                rowOf({ challengeAnswers: { [exitKey]: { verdict: { kind: 'met' }, source: 'process', askedAs: `ask:${exitKey}` } } }),
                world([cupId]),
                { positionsReadDeps: readsFor([cupId], cupId) }
            )

            expect(result.type).toBe('Abstain')
        })
    })
})

describe('transcriptContextForResume', () => {
    it('points a resumed outcome at the stored bubble, in the key\'s session', () => {
        const transcript = { messageId: 'MESSAGE#abc', createdTime: 1700000000000, command: 'take cup' }

        expect(transcriptContextForResume(rowOf({ transcript }), 'session-1')).toEqual({ ...transcript, sessionId: 'session-1' })
    })

    it('is undefined for a row with no echo, so the outcome falls back to an OOC line', () => {
        expect(transcriptContextForResume(rowOf(), 'session-1')).toBeUndefined()
    })
})
