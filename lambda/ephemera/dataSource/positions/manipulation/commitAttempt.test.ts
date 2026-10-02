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

const getMembershipContainersMock = internalCache.Positions.getMembershipContainers as jest.MockedFunction<
    typeof internalCache.Positions.getMembershipContainers
>
const planObjectMoveTransferMock = planObjectMoveTransfer as jest.MockedFunction<typeof planObjectMoveTransfer>
const planRelationalEdgeTransferMock = planRelationalEdgeTransfer as jest.MockedFunction<typeof planRelationalEdgeTransfer>
const commitAndPresentStepSequenceMock = commitAndPresentStepSequence as jest.MockedFunction<typeof commitAndPresentStepSequence>

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

    it('is a no-op for an action with no desiredResult (containment, not yet joined per AP-4)', async () => {
        const attempt = CommandAttempt.fromJSON({
            words: 'put the cup on the tray',
            referents: [],
            actions: [{ kind: 'position', desiredResultDescription: 'Rehost: cup', challenges: [] }],
        })

        await commitAttempt({ attempt, characterId: CHARACTER, messageBus, streamEvent })

        expect(planObjectMoveTransferMock).not.toHaveBeenCalled()
        expect(planRelationalEdgeTransferMock).not.toHaveBeenCalled()
        expect(commitAndPresentStepSequenceMock).not.toHaveBeenCalled()
    })
})
