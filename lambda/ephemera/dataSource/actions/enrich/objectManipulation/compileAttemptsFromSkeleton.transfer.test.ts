import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ParseSkeleton } from './parse/parseToken'
import { planSkeleton } from './plan/planSkeleton'

/** The attempt's last action's desired result: the transfer, which Plan's templates put last. */
const transferStepOf = (result: { type: string; attempt?: unknown }): any => {
    const actions = (result.attempt as { actions: { desiredResult?: unknown }[] }).actions
    return actions[actions.length - 1]?.desiredResult
}
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'

/** Room and host graphs for the shared dry run; the containment move needs the subject's room. */
const containmentPositionsReads = () => ({
    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
})

/** Plan's attempt for a containment skeleton, as parseCommand hands it to the producer. */
const planAttempt = (skeleton: ParseSkeleton, command: string) => {
    const plan = planSkeleton(skeleton, command)
    if (plan.type !== 'attempts') {
        throw new Error(`planAttempt: Plan declined "${command}"`)
    }
    return plan.attempts[0]!
}

const cupId = 'OBJECT#Cup' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

const containmentSkeleton = (
    verb: string,
    subjectSpan: string,
    subjectKey: string,
    prep: string,
    targetSpan: string,
    targetKey: string
): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: subjectKey },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: targetKey },
]

describe('compileAttemptsFromSkeleton (take, drop and containment)', () => {
    it('returns ObjectContainment when subject and target each resolve to exactly one object', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'On', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('returns ObjectContainment with containment In when the caller forwards the In kind', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup in tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'in', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'in', 'tray', 'trayRef'), 'put cup in tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'In', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('resolves the subject from held inventory when it is not in the room catalog', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: trayId, normalizedShortName: 'tray' }],
                heldInventoryCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'On', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('errors with noHostRoom when no hostRoomId is supplied', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
    })

    it('errors with noCatalog when neither catalog is supplied', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
                hostRoomId: roomId,
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noCatalog })
    })

    it('returns Consult, naming both candidates, when the subject span resolves to more than one object', async () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: secondCupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({
            type: 'Consult',
            alternatives: [
                { proposedCommand: 'put the cup on the tray', label: 'cup', referentAnswers: { cupRef: cupId, trayRef: trayId } },
                { proposedCommand: 'put the cup on the tray', label: 'cup', referentAnswers: { cupRef: secondCupId, trayRef: trayId } },
            ],
            confidence: 0.9,
            root: {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                // Plan mints fresh action ids per call, so the frozen attempts are matched by shape.
                attempts: [expect.objectContaining({ actions: expect.any(Array) })],
                confidence: 0.9,
            },
        })
    })

    it('labels each Consult alternative as the whole command when several referents are ambiguous', async () => {
        const redId = 'OBJECT#RedCup' as EphemeraObjectId
        const blueId = 'OBJECT#BlueCup' as EphemeraObjectId
        const skeleton = containmentSkeleton('put', 'cup', 'cupRef1', 'on', 'cup', 'cupRef2')
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on cup',
                skeleton,
                attempts: [planAttempt(skeleton, 'put cup on cup')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: redId, normalizedShortName: 'Red cup' },
                    { objectId: blueId, normalizedShortName: 'Blue cup' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ label }) => label).sort()).toEqual(['put Blue cup on Red cup', 'put Red cup on Blue cup'])
    })

    it('labels with just the ambiguous referent\'s names when the other referent is settled', async () => {
        const redId = 'OBJECT#RedCup' as EphemeraObjectId
        const blueId = 'OBJECT#BlueCup' as EphemeraObjectId
        const skeleton = containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef')
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton,
                attempts: [planAttempt(skeleton, 'put cup on tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: redId, normalizedShortName: 'Red cup' },
                    { objectId: blueId, normalizedShortName: 'Blue cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ label }) => label).sort()).toEqual(['Blue cup', 'Red cup'])
    })

    it('abstains when subject and target resolve to the same object', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on cup',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'cup', 'cupRef2'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'cup', 'cupRef2'), 'put cup on cup')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: expect.any(String),
        })
    })

    it('builds a real, ungrounded transferMembership desiredResult carrying the containment flag', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'CommandAttempt') {
            throw new Error(`expected CommandAttempt, got ${result.type}`)
        }
        const desiredResult = transferStepOf(result)
        expect(desiredResult).toMatchObject({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', stableRefKey: 'cupRef' },
            from: { referentType: 'currentHost' },
            to: { referentType: 'objectSpan', stableRefKey: 'trayRef' },
        })
    })
})
