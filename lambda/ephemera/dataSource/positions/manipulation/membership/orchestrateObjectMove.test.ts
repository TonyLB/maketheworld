import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../../perception/resolveObjectMovePresentationLabels', () => ({
    resolveObjectMovePresentationLabels: jest.fn().mockResolvedValue({
        characterName: 'Alice',
        objectShortName: 'tray',
    }),
}))

jest.mock('./executeObjectMove', () => ({
    executeObjectMove: jest.fn(),
}))

import { orchestrateObjectMove } from './orchestrateObjectMove'
import { executeObjectMove } from './executeObjectMove'
import { resolveObjectMovePresentationLabels } from '../../../perception/resolveObjectMovePresentationLabels'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { buildObjectMoveOp } from '../../membership/buildObjectMoveOp'
import { moveLeaveSlotId, MOVE_ARRIVE_SLOT_ID } from '../kernel/compile/moveBundleSlotIds'
import { EphemeraLudicGraph, objectNode } from '../../ludicGraph'

const executeObjectMoveMock = executeObjectMove as jest.MockedFunction<typeof executeObjectMove>
const resolveLabelsMock = resolveObjectMovePresentationLabels as jest.MockedFunction<
    typeof resolveObjectMovePresentationLabels
>

const TRAY = 'OBJECT#Tray' as EphemeraObjectId
const ROOM = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER = 'CHARACTER#Alice' as EphemeraCharacterId
const WITNESS = 'CHARACTER#Bob' as EphemeraCharacterId

// LP4a: a carry closure is an EphemeraLudicGraph, hosted and rooted at the moved object.
const fragment: EphemeraLudicGraph = EphemeraLudicGraph.fromJSON({
    hostId: TRAY,
    rootId: TRAY, ports: [],
    nodes: [objectNode(TRAY)],
    edges: [],
})

/**
 * The plan `executeObjectMove` would really have returned, compiled here from the same builder so
 * these cases pin the orchestrator's publishing behavior rather than re-asserting the compiler's.
 */
const planFor = (fromHostId: EphemeraRoomId | EphemeraCharacterId, toHostId: EphemeraRoomId | EphemeraCharacterId) =>
    compilePositionKernelOp(buildObjectMoveOp({
        fragment,
        dissolvedEdges: [],
        fromHostId,
        toHostId,
        bundleId: 'BUNDLE#test',
        narration: { characterName: 'Alice', objectShortName: 'tray' },
    }))

describe('orchestrateObjectMove', () => {
    const messageBus = { publish: jest.fn() } as any
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        resolveLabelsMock.mockResolvedValue({ characterName: 'Alice', objectShortName: 'tray' })
    })

    const bundleDeclares = () => (
        messageBus.publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Bundle Declared')
    )

    const slotReports = () => (
        messageBus.publish.mock.calls
            .map((call: any[]) => call[0])
            .filter((message: any) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Slot Reported')
    )

    it('resolves labels once, then declares the bundle and reports both bracket slots', async () => {
        executeObjectMoveMock.mockResolvedValue({
            ok: true,
            plan: planFor(ROOM, CHARACTER),
            captures: new Map([
                ['capture:from:ROOM#Cafe', [CHARACTER, WITNESS]],
                ['capture:to', []],
            ]),
        })

        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        expect(resolveLabelsMock).toHaveBeenCalledTimes(1)
        expect(resolveLabelsMock).toHaveBeenCalledWith({ characterId: CHARACTER, objectId: TRAY, roomId: ROOM })

        expect(bundleDeclares()).toHaveLength(1)
        const declared = await bundleDeclares()[0].getContent()
        expect(declared.slots.map((slot: any) => slot.slotId)).toEqual([
            moveLeaveSlotId(ROOM),
            MOVE_ARRIVE_SLOT_ID,
        ])

        // Both bracket sides report; the character-hosted one just has nobody to tell.
        const reports = await Promise.all(slotReports().map((report: any) => report.getContent()))
        expect(reports).toHaveLength(2)
        expect(reports[0].message).toMatchObject({
            targets: [CHARACTER, WITNESS],
            message: ['Alice picks up tray'],
        })
        expect(reports[1].message).toMatchObject({ targets: [] })
    })

    it('narrates a drop with the room on the arrive side', async () => {
        executeObjectMoveMock.mockResolvedValue({
            ok: true,
            plan: planFor(CHARACTER, ROOM),
            captures: new Map([
                ['capture:from:CHARACTER#Alice', []],
                ['capture:to', [CHARACTER, WITNESS]],
            ]),
        })

        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: CHARACTER,
            toHostId: ROOM,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        const reports = await Promise.all(slotReports().map((report: any) => report.getContent()))
        const roomReport = reports.find((report: any) => report.message.targets.length > 0)
        expect(roomReport.message.message).toEqual(['Alice drops tray'])
    })

    it('passes narration ingredients into the commit path, so captures land in the same transaction', async () => {
        executeObjectMoveMock.mockResolvedValue({ ok: false })

        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        expect(executeObjectMoveMock).toHaveBeenCalledWith(expect.objectContaining({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            narration: { characterName: 'Alice', objectShortName: 'tray' },
        }))
    })

    it('never narrates a commit that did not happen', async () => {
        executeObjectMoveMock.mockResolvedValue({ ok: false })

        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        expect(bundleDeclares()).toHaveLength(0)
        expect(slotReports()).toHaveLength(0)
    })

    it('is a no-op without an object', async () => {
        await orchestrateObjectMove({
            objectIds: [],
            fromHostId: ROOM,
            toHostId: CHARACTER,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        expect(executeObjectMoveMock).not.toHaveBeenCalled()
        expect(resolveLabelsMock).not.toHaveBeenCalled()
    })

    it('proceeds on a rehost between two objects, with no character among the two hosts (PV1-2 follow-up)', async () => {
        // A containment move's toHostId can be an object (a tray), and the subject's current
        // host (fromHostId) can be an object too (moving a cup from one tray to another) or a
        // room (a cup sitting on the floor, never held) --- neither host need be a character.
        // `characterId` is now taken explicitly rather than derived from the two hosts, so this
        // no longer silently no-ops. `ok: false` keeps this test focused on the dispatch itself
        // (labels resolved, executeObjectMove reached) rather than the narration/commit path,
        // which other cases in this file already cover.
        executeObjectMoveMock.mockResolvedValue({ ok: false })

        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: 'OBJECT#Tray2' as EphemeraObjectId,
            roomId: ROOM,
            characterId: CHARACTER,
            messageBus,
            streamEvent,
        })

        expect(resolveLabelsMock).toHaveBeenCalledWith({ characterId: CHARACTER, objectId: TRAY, roomId: ROOM })
        expect(executeObjectMoveMock).toHaveBeenCalledWith(expect.objectContaining({
            objectIds: [TRAY],
            fromHostId: ROOM,
            toHostId: 'OBJECT#Tray2',
        }))
    })

    it('threads containment through to executeObjectMove when set (put on a tray)', async () => {
        executeObjectMoveMock.mockResolvedValue({ ok: false })

        const TRAY2 = 'OBJECT#Tray2' as EphemeraObjectId
        await orchestrateObjectMove({
            objectIds: [TRAY],
            fromHostId: CHARACTER,
            toHostId: TRAY2,
            roomId: ROOM,
            characterId: CHARACTER,
            containment: 'On',
            messageBus,
            streamEvent,
        })

        expect(executeObjectMoveMock).toHaveBeenCalledWith(expect.objectContaining({
            fromHostId: CHARACTER,
            toHostId: TRAY2,
            containment: 'On',
        }))
    })
})
