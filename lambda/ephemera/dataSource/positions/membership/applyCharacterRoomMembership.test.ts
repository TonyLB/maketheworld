import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyCharacterRoomMembership } from './applyCharacterRoomMembership'
import * as kernelPersist from '../manipulation/applyHostEffects'

jest.mock('../manipulation/applyHostEffects', () => ({
    applyHostEffects: jest.fn(),
}))

jest.mock('../../../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CharacterMeta: {
            get: jest.fn(),
            invalidate: jest.fn(),
        },
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getMembershipContainers: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
        Global: { get: jest.fn() },
        RoomAssets: { get: jest.fn().mockResolvedValue([]) },
    },
}))

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'

const applyHostEffectsMock = kernelPersist.applyHostEffects as jest.MockedFunction<
    typeof kernelPersist.applyHostEffects
>
const getRoomCharacterListMock = getRoomCharacterList as jest.MockedFunction<typeof getRoomCharacterList>

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const ROOM_C = 'ROOM#TestThree' as EphemeraRoomId

const postApplyNavigateGraphs = {
    [FROM_ROOM]: { nodes: [], edges: [] as [] },
    [TO_ROOM]: {
        nodes: [{ tag: 'Character' as const, universalKey: CHARACTER_ID }],
        edges: [] as [],
    },
}

describe('applyCharacterRoomMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.CharacterMeta.get as jest.Mock).mockResolvedValue({
            EphemeraId: CHARACTER_ID,
            Name: 'Test',
            HomeId: 'ROOM#VORTEX',
            assets: ['primitives'],
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
        })
        ;(internalCache.Global.get as jest.Mock).mockResolvedValue('SESSION#abcdef')
        getRoomCharacterListMock.mockImplementation(async (roomId: EphemeraRoomId) => {
            if (roomId === TO_ROOM) {
                return [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test', SessionIds: [] }]
            }
            return []
        })
    })

    it('skips side-effect bundle when membership endpoint is unchanged', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: FROM_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: FROM_ROOM,
            changed: false,
        })
        expect(applyHostEffectsMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.CharacterMeta.invalidate).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
        expect(getRoomCharacterListMock).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when endpoint changes', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: postApplyNavigateGraphs,
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
            roomRosterSnapshots: {
                [FROM_ROOM]: [],
                [TO_ROOM]: [{ EphemeraId: CHARACTER_ID, DisplayName: 'Test', SessionIds: [] }],
            },
        }))
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: CHARACTER_ID,
            header: { type: 'Character Moved' },
            update: expect.objectContaining({
                type: 'Character Moved',
                characterId: CHARACTER_ID,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                beatAnchorTime: 1_700_000_000_000,
                characterName: 'Test',
            }),
        })
        const streamCallOrder = streamEvent.mock.invocationCallOrder[0]
        expect(streamCallOrder).toBeLessThan(messageBus.publish.mock.invocationCallOrder[0])
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith(FROM_ROOM)
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.AffordanceRoomDeliverable.invalidate).toHaveBeenCalledWith(FROM_ROOM)
        expect(internalCache.AffordanceRoomDeliverable.invalidate).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.Positions.set).toHaveBeenCalledWith({
            componentId: FROM_ROOM,
            graph: expect.objectContaining({ nodes: [], edges: [] }),
        })
        expect(internalCache.Positions.set).toHaveBeenCalledWith({
            componentId: TO_ROOM,
            graph: expect.objectContaining({
                nodes: expect.arrayContaining([
                    expect.objectContaining({ tag: 'Character', universalKey: CHARACTER_ID }),
                ]),
            }),
        })
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(FROM_ROOM)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(TO_ROOM)
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: CHARACTER_ID,
            containers: [TO_ROOM],
        })
        expect(internalCache.CharacterMeta.invalidate).toHaveBeenCalledWith(CHARACTER_ID)
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [expect.objectContaining({
                type: 'CharacterInPlay',
                CharacterId: CHARACTER_ID,
                RoomId: TO_ROOM,
            })],
        })
    })

    it('runs side-effect bundle for all froms on drift scrub', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, ROOM_C])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: {
                [FROM_ROOM]: { nodes: [], edges: [] as [] },
                [ROOM_C]: { nodes: [], edges: [] as [] },
                [TO_ROOM]: {
                    nodes: [{ tag: 'Character' as const, universalKey: CHARACTER_ID }],
                    edges: [] as [],
                },
            },
        })

        await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                froms: [FROM_ROOM, ROOM_C],
                to: TO_ROOM,
            }),
        }))
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(FROM_ROOM)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(ROOM_C)
        expect(getRoomCharacterListMock).toHaveBeenCalledWith(TO_ROOM)
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_C })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
    })

    it('logs and returns when graph persist fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        applyHostEffectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
            errorMessage: 'boom',
        })

        const result = await applyCharacterRoomMembership(
            { characterId: CHARACTER_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
            errorMessage: 'boom',
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(getRoomCharacterListMock).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
