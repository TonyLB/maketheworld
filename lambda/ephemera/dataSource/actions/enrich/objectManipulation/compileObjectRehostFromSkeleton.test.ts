import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compileObjectRehostFromSkeleton } from './compileObjectRehostFromSkeleton'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ParseSkeleton } from './parse/parseToken'
import { objectSpanRef } from './plan/ungroundedPrimitive'

const cupId = 'OBJECT#Cup' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

const rehostSkeleton = (
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

describe('compileObjectRehostFromSkeleton', () => {
    it('returns ObjectRehost when subject and target each resolve to exactly one object', async () => {
        const result = await compileObjectRehostFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: rehostSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'ObjectRehost',
            subjectId: cupId,
            targetId: trayId,
            hostId: roomId,
            containment: 'On',
            confidence: 0.9,
        })
    })

    it('resolves the subject from held inventory when it is not in the room catalog', async () => {
        const result = await compileObjectRehostFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: rehostSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: trayId, normalizedShortName: 'tray' }],
                heldInventoryCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'ObjectRehost',
            subjectId: cupId,
            targetId: trayId,
            hostId: roomId,
            containment: 'On',
            confidence: 0.9,
        })
    })

    it('errors with noHostRoom when no hostRoomId is supplied', async () => {
        const result = await compileObjectRehostFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: rehostSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
    })

    it('errors with noCatalog when neither catalog is supplied', async () => {
        const result = await compileObjectRehostFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: rehostSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noCatalog })
    })

    it('errors with ambiguousMatch when the subject span resolves to more than one object', async () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = await compileObjectRehostFromSkeleton(
            {
                command: 'put cup on tray',
                skeleton: rehostSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'),
                subject: objectSpanRef('cup', 'cupRef'),
                target: objectSpanRef('tray', 'trayRef'),
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: secondCupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.ambiguousMatch })
    })
})
