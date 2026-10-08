import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: { getMembershipContainers: jest.fn(), getLudicGraph: jest.fn() },
    },
}))

/** Names each requested object or character by its id's lower-cased tail (`OBJECT#Broom` -> `broom`). */
jest.mock('../../perception/resolveNarrationLabels', () => ({
    resolveNarrationLabels: jest.fn(async ({ ids }: { ids: string[] }) => ({
        characterName: 'Alice',
        names: Object.fromEntries(ids.map((id) => [id, id.split('#')[1]!.toLowerCase()])),
    })),
}))

jest.mock('./membership/planObjectMoveTransfer', () => ({
    planObjectMoveTransfer: jest.fn(),
}))

jest.mock('./relational/planRelationalEdgeTransfer', () => ({
    planRelationalEdgeTransfer: jest.fn(),
}))

jest.mock('./kernel/dryRunStepSequence', () => ({
    dryRunStepSequence: jest.fn(),
}))

jest.mock('./kernel/commitAndPresentStepSequence', () => ({
    commitAndPresentStepSequence: jest.fn().mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() }),
}))

/**
 * Delivery itself (resolving a unit's audience to a live roster and publishing) is this
 * module's own concern, tested directly in `deliverNarrationUnits.test.ts`. This file mocks it
 * away so its existing, heavily-mocked-compile-chain tests (which never populate `captures`)
 * don't trip the no-live-roster-fallback invariant --- `commitAttempt`'s own narration-unit
 * tests below assert on what this mock is called with instead.
 */
jest.mock('./deliverNarrationUnits', () => ({
    deliverNarrationUnits: jest.fn(),
}))

import internalCache from '../../../internalCache'
import { commitAttempt } from './commitAttempt'
import { CommandAttempt } from '../../actions/commandAttempt'
import { planMembershipDesiredResult } from '../../actions/enrich/objectManipulation/plan/matchMembershipTemplate'
import { stampCandidateReferents } from '../../actions/enrich/objectManipulation/stampCandidateReferents'
import { PositionAttemptAction } from '../../actions/commandAttempt/action'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'
import { planRelationalEdgeTransfer } from './relational/planRelationalEdgeTransfer'
import { commitAndPresentStepSequence } from './kernel/commitAndPresentStepSequence'
import { dryRunStepSequence } from './kernel/dryRunStepSequence'
import { deliverNarrationUnits } from './deliverNarrationUnits'

const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const planObjectMoveTransferMock = planObjectMoveTransfer as jest.MockedFunction<typeof planObjectMoveTransfer>
const planRelationalEdgeTransferMock = planRelationalEdgeTransfer as jest.MockedFunction<typeof planRelationalEdgeTransfer>
const commitAndPresentStepSequenceMock = commitAndPresentStepSequence as jest.MockedFunction<typeof commitAndPresentStepSequence>
const dryRunStepSequenceMock = dryRunStepSequence as jest.MockedFunction<typeof dryRunStepSequence>
const deliverNarrationUnitsMock = deliverNarrationUnits as jest.MockedFunction<typeof deliverNarrationUnits>

const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId

/**
 * Built the way Plan and the shared producer build it, then round-tripped through JSON, so the
 * fixture is exactly what actions publishes: the step grounded by key, the object's id on the
 * attempt's referents.
 */
const membershipAttempt = (operation: 'takeHold' | 'drop' = 'takeHold'): CommandAttempt => {
    const step = stampCandidateReferents(
        planMembershipDesiredResult(operation, 'broom', 'primaryObject'),
        new Map([['primaryObject', { id: BROOM, shortName: 'broom' }]])
    )
    return CommandAttempt.fromJSON(
        CommandAttempt.create('pick up the broom', [
            new PositionAttemptAction('action-1', [], step, `${operation === 'takeHold' ? 'Take' : 'Drop'}: broom`),
        ]).toJSON()
    )
}

/** Strips the `capture` steps audience resolution now splices around a narrated action, so tests that predate audience resolution can keep asserting the core mutation steps' order without pinning exactly how many rooms a narration unit's audience resolved to. */
const withoutCaptureSteps = (steps: readonly { kind: string }[]) => steps.filter((step) => step.kind !== 'capture')

/** Character is in ROOM; the broom is wherever `broomHost` says. */
const mockLiveHosts = (broomHost: EphemeraRoomId | EphemeraCharacterId | EphemeraObjectId | undefined) => {
    getMembershipContainersMock.mockImplementation(async (id) => {
        if (id === CHARACTER) {
            return [ROOM]
        }
        return broomHost === undefined ? [] : [broomHost]
    })
}

/** A containment move's attempt: one `transferMembership` action carrying a
 * `containment` flag, `from` derived from the subject's own span (`currentHost(span:subject)`),
 * ungrounded on `object`/`to` --- same shape the real producer builds. */
const containmentAttempt = (containment: 'On' | 'In' = 'On'): CommandAttempt => CommandAttempt.fromJSON({
    words: 'put the cup on the tray',
    referents: [
        { refKey: 'subject', id: BROOM, shortName: 'cup' },
        { refKey: 'target', id: TABLE, shortName: 'tray' },
    ],
    actions: [{
        kind: 'position',
        id: 'action-2',
        desiredResult: {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'subject', groundedId: BROOM, shortName: 'cup' },
            from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'subject', groundedId: BROOM, shortName: 'cup' } },
            to: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'target', groundedId: TABLE, shortName: 'tray' },
            containment,
        } as never,
        challenges: [],
    }],
    narrationUnits: [],
})

const relationalAttempt = (primitive: 'establishRelation' | 'dissolveRelation' = 'establishRelation'): CommandAttempt => CommandAttempt.fromJSON({
    words: 'put the broom under the table',
    referents: [],
    actions: [{
        kind: 'position',
        id: 'action-3',
        desiredResult: {
            kind: 'change',
            primitive,
            subject: { referentType: 'objectSpan', span: 'subject', groundedId: BROOM },
            target: { referentType: 'objectSpan', span: 'target', groundedId: TABLE },
            relationKind: 'Custom', relationLabel: 'under',
        } as never,
        challenges: [],
    }],
    narrationUnits: [],
})

describe('commitAttempt', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        commitAndPresentStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
        dryRunStepSequenceMock.mockResolvedValue({ verdict: 'legal', graphs: new Map(), captures: new Map() })
        mockLiveHosts(ROOM)
        /** No presence bindings by default: audience resolution falls to a dead end, not a thrown error, for a host with no narration-unit test coverage of its own. */
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue({ relationalEdges: [], presenceNodes: [] })
    })

    it('grounds a published (ungrounded) take against live state and dispatches it through planObjectMoveTransfer', async () => {
        mockLiveHosts(ROOM)
        const plan = { steps: [{ kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }], slots: [] }
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: plan as any, fromHostId: ROOM })

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(getMembershipContainersMock).toHaveBeenCalledWith(CHARACTER)
        expect(getMembershipContainersMock).toHaveBeenCalledWith(BROOM)
        expect(planObjectMoveTransferMock).toHaveBeenCalledWith(expect.objectContaining({
            entityId: BROOM,
            fromHostId: ROOM,
            toHostId: CHARACTER,
        }))
        const [committedPlan] = commitAndPresentStepSequenceMock.mock.calls[0]!
        expect(withoutCaptureSteps(committedPlan.steps)).toEqual(plan.steps)
        expect(committedPlan.slots).toEqual([])
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            CHARACTER,
            expect.objectContaining({
                commit: expect.objectContaining({ messageBus, streamEvent }),
            })
        )
    })

    it('grounds a take from wherever the object live is (on a table, not the room)', async () => {
        mockLiveHosts(TABLE)
        planObjectMoveTransferMock.mockResolvedValue({ ok: false, errorCode: 'stop' })

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).toHaveBeenCalledWith(expect.objectContaining({
            entityId: BROOM,
            fromHostId: TABLE,
            toHostId: CHARACTER,
        }))
    })

    it('grounds a published drop with the character as source and the room as destination', async () => {
        mockLiveHosts(CHARACTER)
        planObjectMoveTransferMock.mockResolvedValue({ ok: false, errorCode: 'stop' })

        await commitAttempt({ attempt: membershipAttempt('drop'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).toHaveBeenCalledWith(expect.objectContaining({
            entityId: BROOM,
            fromHostId: CHARACTER,
            toHostId: ROOM,
        }))
    })

    it('does not commit when the acting character is not in exactly one room', async () => {
        getMembershipContainersMock.mockResolvedValue([])

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('does not commit a drop of an object no longer held (drift)', async () => {
        mockLiveHosts(ROOM)

        await commitAttempt({ attempt: membershipAttempt('drop'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('does not commit a take of an object already held', async () => {
        mockLiveHosts(CHARACTER)

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('uses the same bundleId for planObjectMoveTransfer and the final commit', async () => {
        mockLiveHosts(ROOM)
        const plan = { steps: [{ kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }], slots: [] }
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: plan as any, fromHostId: ROOM })

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).toHaveBeenCalledTimes(1)
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
        const [planArgs] = planObjectMoveTransferMock.mock.calls[0]!
        const [, commitBundleId] = commitAndPresentStepSequenceMock.mock.calls[0]!
        expect(commitBundleId).toBe((planArgs as any).bundleId)
    })

    it('does not commit when the object has no single current host (drift)', async () => {
        mockLiveHosts(undefined)

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('does not commit when planObjectMoveTransfer refuses', async () => {
        mockLiveHosts(ROOM)
        planObjectMoveTransferMock.mockResolvedValue({ ok: false, errorCode: 'transferInteractionDefer' })

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('dispatches a relational action through planRelationalEdgeTransfer, with its edge for the one fact', async () => {
        const steps = [{ kind: 'establishRelation', subjectId: BROOM, targetId: TABLE, hostId: ROOM, relationKind: 'Custom', relationLabel: 'under' }]
        planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: steps as any })

        await commitAttempt({ attempt: relationalAttempt('establishRelation'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planRelationalEdgeTransferMock).toHaveBeenCalledWith(expect.objectContaining({ primitive: 'establishRelation' }))
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledWith(
            expect.objectContaining({ steps, slots: [] }),
            expect.any(String),
            CHARACTER,
            expect.objectContaining({
                commit: expect.objectContaining({
                    relationalEdges: [{ subjectId: BROOM, targetId: TABLE, operation: 'establish', relationKind: 'Custom', relationLabel: 'under' }],
                }),
            })
        )
    })

    it('does not commit when planRelationalEdgeTransfer refuses', async () => {
        planRelationalEdgeTransferMock.mockResolvedValue({ ok: false, errorCode: 'noChain', errorMessage: 'no chain' })

        await commitAttempt({ attempt: relationalAttempt('establishRelation'), characterId: CHARACTER, messageBus, streamEvent })

        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('concatenates a membership and a relational action into one commit', async () => {
        mockLiveHosts(ROOM)
        const membershipStep = { kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: TABLE }
        const relationalStep = { kind: 'establishRelation', subjectId: BROOM, targetId: TABLE, hostId: TABLE, relationKind: 'On' }
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [membershipStep], slots: [] } as any, fromHostId: ROOM })
        planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: [relationalStep] as any })

        const mixedAttempt = CommandAttempt.fromJSON({
            words: 'put the broom on the table',
            referents: [
                { refKey: 'subject', id: BROOM, shortName: 'broom' },
                { refKey: 'target', id: TABLE, shortName: 'table' },
            ],
            actions: [
                {
                    kind: 'position',
                    id: 'action-4',
                    desiredResult: {
                        kind: 'change',
                        primitive: 'transferMembership',
                        object: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'subject', groundedId: BROOM, shortName: 'broom' },
                        from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'subject', groundedId: BROOM, shortName: 'broom' } },
                        to: { referentType: 'objectSpan', span: 'table', stableRefKey: 'target', groundedId: TABLE, shortName: 'table' },
                    } as never,
                    challenges: [],
                },
                {
                    kind: 'position',
                    id: 'action-5',
                    desiredResult: {
                        kind: 'change',
                        primitive: 'establishRelation',
                        subject: { referentType: 'objectSpan', span: 'subject', groundedId: BROOM },
                        target: { referentType: 'objectSpan', span: 'target', groundedId: TABLE },
                        relationKind: 'On',
                    } as never,
                    challenges: [],
                },
            ],
            narrationUnits: [],
        })

        await commitAttempt({ attempt: mixedAttempt, characterId: CHARACTER, messageBus, streamEvent })

        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
        const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]
        expect(withoutCaptureSteps(plan.steps)).toEqual([membershipStep, relationalStep])
    })

    it('commits a lashed object\'s met dissolve before its containment transfer, in one commit (ISS8203 slice 3 payoff)', async () => {
        const dissolveStep = { kind: 'dissolveRelation', subjectId: BROOM, targetId: TABLE, hostId: ROOM, relationKind: 'Custom', relationLabel: 'is lashed to' }
        const transferStep = { kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: TABLE }
        planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: [dissolveStep] as any })
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [transferStep], slots: [] } as any, fromHostId: ROOM })

        // The published attempt, as parseCommand's round trip hands it over: the met dissolve first.
        const published = CommandAttempt.fromJSON({
            words: 'put the broom on the table',
            referents: [
                { refKey: 'subject', id: BROOM, shortName: 'broom' },
                { refKey: 'target', id: TABLE, shortName: 'table' },
            ],
            actions: [
                {
                    kind: 'position',
                    id: 'action-6',
                    desiredResult: {
                        kind: 'change',
                        primitive: 'dissolveRelation',
                        subject: { referentType: 'graphNode', groundedId: BROOM },
                        target: { referentType: 'graphNode', groundedId: TABLE },
                        relationKind: 'Custom',
                        relationLabel: 'is lashed to',
                    } as never,
                    challenges: [{ kind: 'customEdge', id: 'c1', description: 'lashed', edge: { from: BROOM, to: TABLE, kind: 'Custom', relationLabel: 'is lashed to' }, verdict: { kind: 'met' } }],
                },
                {
                    kind: 'position',
                    id: 'action-7',
                    desiredResult: {
                        kind: 'change',
                        primitive: 'transferMembership',
                        object: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'subject', groundedId: BROOM, shortName: 'broom' },
                        from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'subject', groundedId: BROOM, shortName: 'broom' } },
                        to: { referentType: 'objectSpan', span: 'table', stableRefKey: 'target', groundedId: TABLE, shortName: 'table' },
                        containment: 'On',
                    } as never,
                    challenges: [],
                },
            ],
            narrationUnits: [],
        } as never)

        await commitAttempt({ attempt: published, characterId: CHARACTER, messageBus, streamEvent })

        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
        const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]
        expect(withoutCaptureSteps(plan.steps)).toEqual([dissolveStep, transferStep])
    })

    it('is a no-op for an action with no desiredResult', async () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'look at the cup',
            referents: [],
            actions: [{ kind: 'position', id: 'action-8', desiredResultDescription: 'Describe: cup', challenges: [] }],
            narrationUnits: [],
        })

        await commitAttempt({ attempt, characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(planRelationalEdgeTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })

    it('dispatches a containment action through planObjectMoveTransfer with its containment flag', async () => {
        mockLiveHosts(ROOM)
        const plan = { steps: [{ kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: TABLE }], slots: [] }
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: plan as any, fromHostId: ROOM })

        await commitAttempt({ attempt: containmentAttempt('On'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).toHaveBeenCalledWith(expect.objectContaining({
            entityId: BROOM,
            fromHostId: ROOM,
            toHostId: TABLE,
            containment: 'On',
        }))
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
    })

    it('omits the containment field when planObjectMoveTransfer is called for an ordinary membership move', async () => {
        mockLiveHosts(ROOM)
        const plan = { steps: [{ kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }], slots: [] }
        planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: plan as any, fromHostId: ROOM })

        await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

        const [callArgs] = planObjectMoveTransferMock.mock.calls[0]!
        expect(callArgs).not.toHaveProperty('containment')
    })

    describe('narration units', () => {
        /** Plan's own unit for a take, as `matchMembershipTemplate` authors it, plus an *after* variant to exercise that phase. */
        const takeUnit = {
            covers: ['action-1'],
            variants: [
                { audience: { refs: ['actor', 'primaryObject'], phase: 'before' as const }, parts: [{ slot: 'actor' as const }, { text: ' picks up ' }, { ref: 'primaryObject' }] },
                { audience: { refs: ['primaryObject'], phase: 'after' as const }, parts: [{ slot: 'actor' as const }, { text: ' picks up ' }, { ref: 'primaryObject' }] },
            ],
        }

        it('delivers an authored take\'s unit, its before and after audiences resolving to the room, not the raw hosts', async () => {
            mockLiveHosts(ROOM)
            // The character's own graph carries a presence binding into ROOM --- the fixture
            // Audience resolution's walk needs to resolve the 'after' side (the moved broom's destination,
            // the bare CHARACTER host) up to the room everyone else actually witnesses the take in.
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) => (
                hostId === CHARACTER
                    ? { relationalEdges: [], presenceNodes: [{ tag: 'Presence', universalKey: 'PRESENCE#alice-binding', fromHostId: ROOM, cover: { tag: 'Full' } }] }
                    : { relationalEdges: [], presenceNodes: [] }
            ))
            const takePlan = { steps: [{ kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }], slots: [] }
            planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: takePlan as any, fromHostId: ROOM })
            const take = membershipAttempt('takeHold')

            await commitAttempt({ attempt: CommandAttempt.create(take.words, take.actions(), [takeUnit]), characterId: CHARACTER, messageBus, streamEvent })

            expect(deliverNarrationUnitsMock).toHaveBeenCalledTimes(1)
            const [sweepArgs] = deliverNarrationUnitsMock.mock.calls[0]!
            expect(sweepArgs.units).toEqual([takeUnit])
            // Labels are the attempt's, resolved once and filled at delivery, not baked into the unit.
            expect(sweepArgs.actorName).toBe('Alice')
            expect(sweepArgs.labels).toEqual({ primaryObject: 'broom' })
            const [committedPlan, commitBundleId] = commitAndPresentStepSequenceMock.mock.calls[0]!
            expect(sweepArgs.bundleId).toBe(commitBundleId)

            const [beforeVariant, afterVariant] = sweepArgs.units[0]!.variants
            const beforeCaptureIds = sweepArgs.resolveCaptureId(sweepArgs.units[0]!, beforeVariant!.audience)
            const afterCaptureIds = sweepArgs.resolveCaptureId(sweepArgs.units[0]!, afterVariant!.audience)
            expect(beforeCaptureIds).toHaveLength(1)
            expect(afterCaptureIds).toHaveLength(1)
            // Distinct minted ids (two moves must not share a fixed `capture:to`), both resolving
            // to ROOM --- not to CHARACTER, which the old `capture:to`-on-raw-host wiring captured.
            expect(beforeCaptureIds).not.toEqual(afterCaptureIds)
            const captureSteps = [...committedPlan.steps].filter((step: any) => step.kind === 'capture')
            expect(captureSteps).toEqual([
                { kind: 'capture', hostId: ROOM, captureId: beforeCaptureIds[0] },
                { kind: 'capture', hostId: ROOM, captureId: afterCaptureIds[0] },
            ])
        })

        it('narrates nothing for a membership action no unit covers: positions derives no copy', async () => {
            mockLiveHosts(ROOM)
            planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [], slots: [] } as any, fromHostId: ROOM })

            await commitAttempt({ attempt: membershipAttempt('takeHold'), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
            expect(deliverNarrationUnitsMock).not.toHaveBeenCalled()
        })

        it('delivers authored units in action order, and nothing for an uncovered move in the same attempt', async () => {
            const MOP = 'OBJECT#Mop' as EphemeraObjectId
            const takeOf = (id: string, objectId: EphemeraObjectId, key: string) => new PositionAttemptAction(id, [], stampCandidateReferents(
                planMembershipDesiredResult('takeHold', key, key),
                new Map([[key, { id: objectId, shortName: key }]])
            ), `Take: ${key}`)
            const unitFor = (actionId: string, key: string) => ({
                covers: [actionId],
                variants: [{ audience: { refs: [key], phase: 'before' as const }, parts: [{ slot: 'actor' as const }, { text: ' snatches ' }, { ref: key }] }],
            })
            const attempt = CommandAttempt.fromJSON(CommandAttempt.create('take the mop, the bucket and the broom', [
                takeOf('take-mop', MOP, 'mop'),
                takeOf('take-bucket', 'OBJECT#Bucket' as EphemeraObjectId, 'bucket'),
                takeOf('take-broom', BROOM, 'broom'),
            ], [unitFor('take-broom', 'broom'), unitFor('take-mop', 'mop')]).toJSON())
            planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [], slots: [] } as any, fromHostId: ROOM })

            await commitAttempt({ attempt, characterId: CHARACTER, messageBus, streamEvent })

            const [sweepArgs] = deliverNarrationUnitsMock.mock.calls[0]!
            expect(sweepArgs.units.map(({ covers }) => covers)).toEqual([['take-mop'], ['take-broom']])
            // An authored ref is a stableRefKey; its label is its grounded object's name.
            expect(sweepArgs.labels).toEqual({ mop: 'mop', broom: 'broom' })
        })

        it('labels every ref of a delivered unit: a character by its name, a kind the resolver does not name by the fallback', async () => {
            // A recipient is a character (a future "gives the broom to Bob"); a Feature is named by nothing yet.
            const BOB = 'CHARACTER#Bob'
            const NICHE = 'FEATURE#Niche'
            const take = membershipAttempt('takeHold')
            const authored = {
                covers: ['action-1'],
                variants: [{
                    audience: { refs: ['actor'], phase: 'before' as const },
                    parts: [{ slot: 'actor' as const }, { text: ' hands ' }, { ref: BOB }, { text: ' the ' }, { ref: 'primaryObject' }, { text: ' by ' }, { ref: NICHE }],
                }],
            }
            planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [], slots: [] } as any, fromHostId: ROOM })

            await commitAttempt({ attempt: CommandAttempt.create(take.words, take.actions(), [authored]), characterId: CHARACTER, messageBus, streamEvent })

            const [sweepArgs] = deliverNarrationUnitsMock.mock.calls[0]!
            expect(sweepArgs.labels).toEqual({ [BOB]: 'bob', primaryObject: 'broom', [NICHE]: 'something' })
        })

        it('calls deliverNarrationUnits with no units for a purely relational attempt --- no unit covers it', async () => {
            const steps = [{ kind: 'establishRelation', subjectId: BROOM, targetId: TABLE, hostId: ROOM, relationKind: 'Custom', relationLabel: 'under' }]
            planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: steps as any })

            await commitAttempt({ attempt: relationalAttempt('establishRelation'), characterId: CHARACTER, messageBus, streamEvent })

            expect(deliverNarrationUnitsMock).not.toHaveBeenCalled()
        })
    })

    describe('a take with a facilitating boundary dissolve', () => {
        const POST = 'OBJECT#Post' as EphemeraObjectId
        const lashed = { from: BROOM, to: POST, kind: 'Custom' as const, relationLabel: 'is lashed to' }
        const dissolveStep = { kind: 'dissolveRelation', subjectId: BROOM, targetId: POST, hostId: ROOM, relationKind: 'Custom', relationLabel: 'is lashed to' }
        const transferStep = { kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }

        /** The producer's shape: the dissolve action first, the take last, in execution order. */
        const OTHER_ROOM = 'ROOM#Kitchen' as EphemeraRoomId
        /** Plan's own unit for the take, as `matchMembershipTemplate` authors it. */
        const takeUnit = {
            covers: ['action-1'],
            variants: [{ audience: { refs: ['actor', 'primaryObject'], phase: 'before' as const }, parts: [{ slot: 'actor' as const }, { text: ' picks up ' }, { ref: 'primaryObject' }] }],
        }
        /** Expansion's own unit for the dissolve, as `attemptActionsFromBoundaryOutcomes` authors it. */
        const dissolveUnit = {
            covers: ['action-9'],
            variants: [{
                audience: { refs: [`graphNode:${BROOM}`, `graphNode:${POST}`], phase: 'before' as const },
                parts: [{ slot: 'actor' as const }, { text: ' frees ' }, { ref: `graphNode:${BROOM}` }, { text: ' from ' }, { ref: `graphNode:${POST}` }],
            }],
        }
        const lashedTakeAttempt = (
            verdict: { kind: 'met' } | undefined,
            presence: { subject: unknown[]; target: unknown[] } = { subject: [ROOM], target: [OTHER_ROOM] }
        ): CommandAttempt => {
            const take = membershipAttempt('takeHold').toJSON()
            return CommandAttempt.fromJSON({
                ...take,
                narrationUnits: [dissolveUnit, takeUnit],
                actions: [
                    {
                        kind: 'position',
                        id: 'action-9',
                        desiredResult: {
                            kind: 'change',
                            primitive: 'dissolveRelation',
                            subject: { referentType: 'graphNode', groundedId: BROOM, groundedPresence: presence.subject },
                            target: { referentType: 'graphNode', groundedId: POST, groundedPresence: presence.target },
                            relationKind: 'Custom',
                            relationLabel: 'is lashed to',
                        } as never,
                        desiredResultDescription: 'Dissolve: is lashed to',
                        challenges: [{ kind: 'customEdge', id: 'c1', edge: lashed as never, description: 'd', ...(verdict ? { verdict } : {}) }],
                    },
                    ...take.actions,
                ],
            })
        }

        beforeEach(() => {
            planObjectMoveTransferMock.mockResolvedValue({ ok: true, plan: { steps: [transferStep], slots: [] } as any, fromHostId: ROOM })
            planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: [dissolveStep] as any })
        })

        it('commits the attempt\'s own dissolve once, before the transfer', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
            const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]!
            expect(withoutCaptureSteps(plan.steps)).toEqual([dissolveStep, transferStep])
        })

        it('delivers Expansion\'s dissolve line before Plan\'s take line (action order), filled from the attempt\'s labels', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(deliverNarrationUnitsMock).toHaveBeenCalledTimes(1)
            const [sweepArgs] = deliverNarrationUnitsMock.mock.calls[0]!
            expect(sweepArgs.units.map(({ covers }) => covers)).toEqual([['action-9'], ['action-1']])
            expect(sweepArgs.units).toEqual([dissolveUnit, takeUnit])
            expect(sweepArgs.labels).toEqual({ [`graphNode:${BROOM}`]: 'broom', [`graphNode:${POST}`]: 'post', primaryObject: 'broom' })
        })

        it('resolves the dissolve\'s one audience through each end\'s stamped presence, captured ahead of the dissolve', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            const [sweepArgs] = deliverNarrationUnitsMock.mock.calls[0]!
            const dissolveCaptureIds = sweepArgs.resolveCaptureId(sweepArgs.units[0]!, sweepArgs.units[0]!.variants[0]!.audience)
            const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]!
            const dissolveIndex = plan.steps.findIndex((step) => step.kind === 'dissolveRelation')
            const dissolveCaptures = plan.steps.slice(0, dissolveIndex)
            // The post's stamped room, not the live host every unstamped ref would fall back to.
            expect(dissolveCaptures).toEqual(expect.arrayContaining([
                { kind: 'capture', hostId: ROOM, captureId: expect.any(String) },
                { kind: 'capture', hostId: OTHER_ROOM, captureId: expect.any(String) },
            ]))
            expect(dissolveCaptureIds).toHaveLength(2)
            expect(dissolveCaptureIds.every((id) => dissolveCaptures.some((step: any) => step.captureId === id))).toBe(true)
        })

        it('resolves an end stamped with its host\'s binding through that host\'s graph, not the end\'s own', async () => {
            // A lashing on a table bound into the room: Expansion stamps both ends with the table's
            // binding (`presencesHolding(tableGraph, end)`), which lives on the table's graph.
            const TABLE_BINDING = 'PRESENCE#table-binding'
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) => ({
                relationalEdges: [],
                presenceNodes: hostId === TABLE
                    ? [{ tag: 'Presence', universalKey: TABLE_BINDING, fromHostId: ROOM, cover: { tag: 'Full' } }]
                    : [],
            }))
            const stamp = [{ host: TABLE, presence: TABLE_BINDING }]
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }, { subject: stamp, target: stamp }), characterId: CHARACTER, messageBus, streamEvent })

            const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]!
            const dissolveIndex = plan.steps.findIndex((step) => step.kind === 'dissolveRelation')
            expect(plan.steps.slice(0, dissolveIndex)).toEqual([{ kind: 'capture', hostId: ROOM, captureId: expect.any(String) }])
        })

        it('dry-runs the whole attempt\'s sequence, not one fragment', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(dryRunStepSequenceMock).toHaveBeenCalledTimes(1)
            const [dryRunSteps] = dryRunStepSequenceMock.mock.calls[0]!
            expect(withoutCaptureSteps(dryRunSteps)).toEqual([dissolveStep, transferStep])
        })

        it('refuses the whole attempt when its take has no single live host: the lashing survives', async () => {
            mockLiveHosts(undefined)

            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
        })

        it('refuses the whole attempt when its take is already held, with the held message', async () => {
            mockLiveHosts(CHARACTER)
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
            // A covered action always happened, so a refused attempt delivers no unit at all.
            expect(deliverNarrationUnitsMock).not.toHaveBeenCalled()
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`is already on ${CHARACTER}`))
            errorSpy.mockRestore()
        })

        it('refuses the whole attempt when its dissolve cannot be built, even with the take legal', async () => {
            planRelationalEdgeTransferMock.mockResolvedValue({ ok: false, errorCode: 'noChain', errorMessage: 'no chain' })

            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
            expect(deliverNarrationUnitsMock).not.toHaveBeenCalled()
        })

        it('does not commit an attempt whose challenge is still pending', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt(undefined), characterId: CHARACTER, messageBus, streamEvent })

            expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
            expect(planRelationalEdgeTransferMock).not.toHaveBeenCalled()
            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
        })

        it('refuses, rather than repairs, a boundary edge the attempt does not cover', async () => {
            dryRunStepSequenceMock.mockResolvedValue({
                verdict: 'repairable',
                reasonCode: 'unresolvedDissolveEdge',
                authority: 'mechanical',
                repair: { kind: 'dissolveEdge', hostId: ROOM, edge: { from: BROOM, to: TABLE, kind: 'Custom', relationLabel: 'against' } } as never,
            })

            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
            expect(deliverNarrationUnitsMock).not.toHaveBeenCalled()
        })
    })
})
