import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compileObjectContainmentFromSkeleton } from './compileObjectContainmentFromSkeleton'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ParseSkeleton } from './parse/parseToken'
import { objectSpanRef } from './plan/planStep'

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

describe('compileObjectContainmentFromSkeleton', () => {
    it('returns ObjectContainment when subject and target each resolve to exactly one object', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'ObjectContainment',
            subjectId: cupId,
            targetId: trayId,
            hostId: roomId,
            containment: 'On',
            confidence: 0.9,
            attempt: expect.anything(),
        })
    })

    it('returns ObjectContainment with containment In when the caller forwards the In kind', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup in tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'in', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'In',
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'ObjectContainment',
            subjectId: cupId,
            targetId: trayId,
            hostId: roomId,
            containment: 'In',
            confidence: 0.9,
            attempt: expect.anything(),
        })
    })

    it('resolves the subject from held inventory when it is not in the room catalog', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: trayId, normalizedShortName: 'tray' }],
                heldInventoryCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'ObjectContainment',
            subjectId: cupId,
            targetId: trayId,
            hostId: roomId,
            containment: 'On',
            confidence: 0.9,
            attempt: expect.anything(),
        })
    })

    it('errors with noHostRoom when no hostRoomId is supplied', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
    })

    it('errors with noCatalog when neither catalog is supplied', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noCatalog })
    })

    it('returns Consult, naming both candidates, when the subject span resolves to more than one object (slice 3c, AP-4)', async () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: secondCupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Consult',
            alternatives: [
                { proposedCommand: 'put the cup on the tray' },
                { proposedCommand: 'put the cup on the tray' },
            ],
            confidence: 0.9,
        })
    })

    it('abstains when subject and target resolve to the same object (AP-12, reused)', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on cup',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'cup', 'cupRef2'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('cup', 'cupRef2'),
                containment: 'On',
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: expect.any(String),
        })
    })

    it('builds a real, ungrounded transferMembership desiredResult carrying the containment flag', async () => {
        const result = await compileObjectContainmentFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                containment: 'On',
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        if (result.type !== 'ObjectContainment') {
            throw new Error(`expected ObjectContainment, got ${result.type}`)
        }
        const desiredResult = result.attempt.actions[0]?.desiredResult as any
        expect(desiredResult).toMatchObject({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', stableRefKey: 'cupRef' },
            from: { referentType: 'currentHost' },
            to: { referentType: 'objectSpan', stableRefKey: 'trayRef' },
            containment: 'On',
        })
    })
})
