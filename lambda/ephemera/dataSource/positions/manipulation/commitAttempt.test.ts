import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: { getMembershipContainers: jest.fn() },
    },
}))

jest.mock('../../perception/resolveObjectMovePresentationLabels', () => ({
    resolveObjectMovePresentationLabels: jest.fn().mockResolvedValue({
        characterName: 'Alice',
        objectShortName: 'broom',
    }),
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

import internalCache from '../../../internalCache'
import { commitAttempt } from './commitAttempt'
import { CommandAttempt } from '../../actions/commandAttempt'
import { groundMembershipCandidate } from '../../actions/enrich/objectManipulation/proposeMembershipCandidates'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'
import { planRelationalEdgeTransfer } from './relational/planRelationalEdgeTransfer'
import { commitAndPresentStepSequence } from './kernel/commitAndPresentStepSequence'
import { dryRunStepSequence } from './kernel/dryRunStepSequence'

const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const planObjectMoveTransferMock = planObjectMoveTransfer as jest.MockedFunction<typeof planObjectMoveTransfer>
const planRelationalEdgeTransferMock = planRelationalEdgeTransfer as jest.MockedFunction<typeof planRelationalEdgeTransfer>
const commitAndPresentStepSequenceMock = commitAndPresentStepSequence as jest.MockedFunction<typeof commitAndPresentStepSequence>
const dryRunStepSequenceMock = dryRunStepSequence as jest.MockedFunction<typeof dryRunStepSequence>

const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const BROOM = 'OBJECT#Broom' as EphemeraObjectId
const TABLE = 'OBJECT#Table' as EphemeraObjectId

/**
 * Built by the real producer and round-tripped through JSON, so the fixture is exactly what
 * actions publishes: the step wholly ungrounded, the object's id only on the attempt's referents.
 */
const membershipAttempt = (operation: 'takeHold' | 'drop' = 'takeHold'): CommandAttempt => CommandAttempt.fromJSON(
    groundMembershipCandidate(
        {
            identity: { objectId: BROOM, label: 'broom', locus: { kind: operation === 'takeHold' ? 'room' : 'heldByActor' } as never, jointRelevance: 1, sourceTags: [] },
            plan: { kind: 'transferMembership', operationKind: operation },
            confidence: 1,
        },
        { words: 'pick up the broom', span: 'broom', catalog: [] }
    ).attempt.toJSON()
)

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
        desiredResult: {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'subject' },
            from: { referentType: 'currentHost', referentTarget: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'subject' } },
            to: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'target' },
            containment,
        } as never,
        challenges: [],
    }],
})

const relationalAttempt = (primitive: 'establishRelation' | 'dissolveRelation' = 'establishRelation'): CommandAttempt => CommandAttempt.fromJSON({
    words: 'put the broom under the table',
    referents: [],
    actions: [{
        kind: 'position',
        desiredResult: {
            kind: 'change',
            primitive,
            subject: { referentType: 'objectSpan', span: 'subject', groundedId: BROOM },
            target: { referentType: 'objectSpan', span: 'target', groundedId: TABLE },
            relationKind: 'Under',
        } as never,
        challenges: [],
    }],
})

describe('commitAttempt', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        commitAndPresentStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1_700_000_000_000, steps: [], captures: new Map() })
        dryRunStepSequenceMock.mockResolvedValue({ verdict: 'legal', graphs: new Map(), captures: new Map() })
        mockLiveHosts(ROOM)
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
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledWith(
            expect.objectContaining({ steps: plan.steps, slots: [] }),
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
        const steps = [{ kind: 'establishRelation', subjectId: BROOM, targetId: TABLE, hostId: ROOM, relationKind: 'Under' }]
        planRelationalEdgeTransferMock.mockResolvedValue({ ok: true, steps: steps as any })

        await commitAttempt({ attempt: relationalAttempt('establishRelation'), characterId: CHARACTER, messageBus, streamEvent })

        expect(planRelationalEdgeTransferMock).toHaveBeenCalledWith(expect.objectContaining({ primitive: 'establishRelation' }))
        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledWith(
            expect.objectContaining({ steps, slots: [] }),
            expect.any(String),
            CHARACTER,
            expect.objectContaining({
                commit: expect.objectContaining({
                    relationalEdges: [{ subjectId: BROOM, targetId: TABLE, operation: 'establish', relationKind: 'Under' }],
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
                    desiredResult: {
                        kind: 'change',
                        primitive: 'transferMembership',
                        object: { referentType: 'objectSpan', span: 'broom', stableRefKey: 'subject' },
                        from: { referentType: 'currentHost', referentTarget: { referentType: 'actingCharacter' } },
                        to: { referentType: 'objectSpan', span: 'table', stableRefKey: 'target' },
                    } as never,
                    challenges: [],
                },
                {
                    kind: 'position',
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
        })

        await commitAttempt({ attempt: mixedAttempt, characterId: CHARACTER, messageBus, streamEvent })

        expect(commitAndPresentStepSequenceMock).toHaveBeenCalledTimes(1)
        const [plan] = commitAndPresentStepSequenceMock.mock.calls[0]
        expect(plan.steps).toEqual([membershipStep, relationalStep])
    })

    it('is a no-op for an action with no desiredResult', async () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'look at the cup',
            referents: [],
            actions: [{ kind: 'position', desiredResultDescription: 'Describe: cup', challenges: [] }],
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

    describe('a take with a facilitating boundary dissolve', () => {
        const POST = 'OBJECT#Post' as EphemeraObjectId
        const lashed = { from: BROOM, to: POST, kind: 'Custom' as const, relationLabel: 'is lashed to' }
        const dissolveStep = { kind: 'dissolveRelation', subjectId: BROOM, targetId: POST, hostId: ROOM, relationKind: 'Custom', relationLabel: 'is lashed to' }
        const transferStep = { kind: 'transferMembership', entityIds: new Set([BROOM]), fromHostIds: new Set([ROOM]), toHostId: CHARACTER }

        /** The producer's shape: the dissolve action first, the take last, in execution order. */
        const lashedTakeAttempt = (verdict: { kind: 'met' } | undefined): CommandAttempt => {
            const take = membershipAttempt('takeHold').toJSON()
            return CommandAttempt.fromJSON({
                ...take,
                actions: [
                    {
                        kind: 'position',
                        desiredResult: {
                            kind: 'change',
                            primitive: 'dissolveRelation',
                            subject: { referentType: 'graphNode', groundedId: BROOM },
                            target: { referentType: 'graphNode', groundedId: POST },
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
            expect(plan.steps).toEqual([dissolveStep, transferStep])
        })

        it('dry-runs the whole attempt\'s sequence, not one fragment', async () => {
            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(dryRunStepSequenceMock).toHaveBeenCalledWith([dissolveStep, transferStep], expect.anything())
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
                repair: { kind: 'dissolveEdge', hostId: ROOM, edge: { from: BROOM, to: TABLE, kind: 'Against' } } as never,
            })

            await commitAttempt({ attempt: lashedTakeAttempt({ kind: 'met' }), characterId: CHARACTER, messageBus, streamEvent })

            expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
        })
    })
})
