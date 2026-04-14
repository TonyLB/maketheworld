import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { handleApiObjectsChangeCommand } from './handleApiObjectsChange'
import { mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'

jest.mock('./mergePersistMetaRoomObjects', () => ({
    mergePersistMetaRoomObjects: jest.fn(),
}))

const mergePersistMetaRoomObjectsMock = mergePersistMetaRoomObjects as jest.MockedFunction<typeof mergePersistMetaRoomObjects>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
})

describe('handleApiObjectsChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomObjectsMock.mockReset()
        mergePersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('calls mergePersistMetaRoomObjects with roomId, add, and remove', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            {
                componentId: roomId,
                add: [obj('o1', 'One')],
                remove: ['OBJECT#o2' as EphemeraObjectId],
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomObjectsMock).toHaveBeenCalledWith({
            roomId,
            add: [obj('o1', 'One')],
            remove: ['OBJECT#o2' as EphemeraObjectId],
        })
    })

    it('does not persist for non-room component ids', async () => {
        await handleApiObjectsChangeCommand(
            { componentId: 'FEATURE#f1', add: [], remove: [] },
            { streamEvent }
        )
        expect(mergePersistMetaRoomObjectsMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('does not stream when merge did not persist', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when merge fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'no row',
        })
        const roomId = 'ROOM#fail' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('x', 'X')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('streams Objects Changed when merge persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        const add = [obj('b', 'B')]
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('a', 'A')],
            newObjects: [obj('a', 'A'), obj('b', 'B')],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add, remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add,
                remove: [],
                priorObjects: [obj('a', 'A')],
                newObjects: [obj('a', 'A'), obj('b', 'B')],
            },
        })
    })
})
