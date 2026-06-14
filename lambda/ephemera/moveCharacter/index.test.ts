import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

jest.mock('../internalCache')
import internalCache from '../internalCache'
import PerceptionThreadsData from '../internalCache/perceptionThreads'

const mockPositionsStreamEvent = jest.fn().mockResolvedValue(undefined)

jest.mock('../dataSource/positions', () => ({
    __esModule: true,
    default: {
        streamEvent: mockPositionsStreamEvent,
    },
    ephemeraPositionsDataSource: {
        streamEvent: mockPositionsStreamEvent,
    },
}))

jest.mock('../dataSource/positions/membership/applyCharacterRoomMembership', () => ({
    applyCharacterRoomMembership: jest.fn(),
}))
import * as membership from '../dataSource/positions/membership/applyCharacterRoomMembership'

jest.mock('./orchestrateNavigate', () => ({
    orchestrateCharacterNavigate: jest.fn(),
}))
import * as orchestrateNavigate from './orchestrateNavigate'

jest.mock('../dataSource/renderOrchestration/subscribedEvents', () => {
    const actual = jest.requireActual('../dataSource/renderOrchestration/subscribedEvents') as object
    return {
        ...actual,
        sendRenderRequested: jest.fn(),
    }
})
import { sendRenderRequested } from '../dataSource/renderOrchestration/subscribedEvents'
import * as kickRoomHeaderBroadcast from '../dataSource/perception/kickRoomHeaderBroadcast'

import moveCharacter, { RoomStackItem } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { EphemeraId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

const applyCharacterRoomMembershipMock = membership.applyCharacterRoomMembership as jest.MockedFunction<
    typeof membership.applyCharacterRoomMembership
>
const orchestrateCharacterNavigateMock = orchestrateNavigate.orchestrateCharacterNavigate as jest.MockedFunction<
    typeof orchestrateNavigate.orchestrateCharacterNavigate
>

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const mockSendRenderRequested = sendRenderRequested as jest.MockedFunction<typeof sendRenderRequested>

/** Character assets intersecting test room canon stacks; filter uses `AssetKey` so short names match `ASSET#...` stack ids. */
const assetsIntersectingTestRooms = ['primitives', 'TownCenter', 'Dockside', 'draftOne', 'draftTwo']

const testEphemeraRecord = (fromRoomStack: RoomStackItem[], toRoomId: EphemeraRoomId, fromDisconnected?: boolean) => (ephemeraId: EphemeraId) => {
    const fromRoomId = RoomKey(fromRoomStack.slice(-1)[0]?.RoomId)
    switch(ephemeraId) {
        case toRoomId:
            return {
                EphemeraId: toRoomId,
                DataCategory: 'Meta::Room',
                activeCharacters: [{ EphemeraId: 'CHARACTER#TestTwo', Name: 'TestTwo', Sessions: ['zyxwvut'] }]
            }
        case fromRoomId:
            return {
                EphemeraId: fromRoomId,
                DataCategory: 'Meta::Room',
                activeCharacters: fromDisconnected ? [] : [{ EphemeraId: 'CHARACTER#Test', Name: 'Test', Sessions: ['abcdef'] }]
            }
        case 'CHARACTER#Test':
            return {
                EphemeraId: 'CHARACTER#Test',
                DataCategory: 'Meta::Character',
                RoomId: fromRoomId,
                RoomStack: fromRoomStack
            }
    }
    throw new Error(`Misuse of testEphemeraRecord utility (EphemeraId: ${ephemeraId}, args: ${JSON.stringify(fromRoomStack, null, 4)} x ${fromRoomId } x ${toRoomId})`)
}

const wrapMocks = (fromRoomStack: RoomStackItem[], toRoomId: EphemeraRoomId, assets: string[], fromDisconnected?: boolean): void => {
    ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ Key, updateReducer, successCallback }) => {
        const priorValue = testEphemeraRecord(fromRoomStack, toRoomId, fromDisconnected)(Key.EphemeraId as EphemeraId)
        const returnValue = produce(priorValue, updateReducer)
        successCallback?.(returnValue, priorValue)
        return returnValue
    })
    ephemeraDBMock.transactWrite.mockImplementation(async (items) => {
        items.forEach((item) => {
            if ('Update' in item && item.Update.successCallback) {
                const priorValue = testEphemeraRecord(fromRoomStack, toRoomId, fromDisconnected)(item.Update.Key.EphemeraId as EphemeraId)
                const returnValue = produce(priorValue, item.Update.updateReducer)
                item.Update.successCallback(returnValue, priorValue)
            }
        })
    })
    internalCacheMock.CharacterMeta.get.mockResolvedValue({
        EphemeraId: 'CHARACTER#Test',
        RoomId: RoomKey(fromRoomStack.slice(-1)[0]?.RoomId || ''),
        RoomStack: fromRoomStack,
        Name: 'Test',
        HomeId: 'ROOM#VORTEX',
        assets,
        Pronouns: 'they/them'
    })
    internalCacheMock.RoomCharacterList.get.mockResolvedValue(fromDisconnected ? [] : [{ EphemeraId: 'CHARACTER#Test', DisplayName: 'Test', SessionIds: ['abcdef'] }])
}

describe('moveCharacter', () => {
    const messageBusPublish = jest.fn()
    const messageBusMock = { publish: messageBusPublish } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        messageBusPublish.mockClear()
        mockSendRenderRequested.mockClear()
        applyCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#TestTwo',
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        orchestrateCharacterNavigateMock.mockResolvedValue(undefined)
        internalCacheMock.Global.get.mockImplementation((key) => (key === 'assets' ? Promise.resolve(['primitives', 'TownCenter']) : Promise.resolve('abcdef')) as any),
        internalCacheMock.CharacterSessions.get.mockResolvedValue(['abcdef'])
        internalCacheMock.OrchestrateMessages.newMessageGroup.mockReturnValue('UUID#MessageGroup')
        internalCacheMock.AssetMetaData = {
            get: jest.fn().mockImplementation(async (ids: string[]) => (
                ids.map((id) => ({ AssetId: id, zone: 'Canon' as const }))
            )),
        } as any

        internalCacheMock.RoomAssets.get.mockImplementation(async (roomId) => {
            switch(roomId) {
                case 'ROOM#TestOne':
                    return ['ASSET#primitives', 'ASSET#TownCenter']
                case 'ROOM#TestTwo':
                    return ['ASSET#TownCenter']
                case 'ROOM#TestThree':
                    return ['ASSET#TownCenter', 'ASSET#draftOne']
                case 'ROOM#TestFour':
                    return ['ASSET#draftOne']
                case 'ROOM#TestFive':
                    return ['ASSET#draftTwo']
                default:
                    return ['ASSET#primitives', 'ASSET#TownCenter', 'ASSET#Dockside']
            }
        })
        internalCacheMock.PerceptionThreads = new PerceptionThreadsData() as any
    })

    it('routes membership persist through applyCharacterRoomMembership then orchestration', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#TestTwo',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestTwo' }],
            messageBus: messageBusMock
        })
        expect(applyCharacterRoomMembershipMock).toHaveBeenCalledWith(
            { characterId: 'CHARACTER#Test', targetRoomId: 'ROOM#TestTwo' },
            expect.objectContaining({
                messageBus: messageBusMock,
                streamEvent: expect.any(Function),
            })
        )
        const passedStreamEvent = applyCharacterRoomMembershipMock.mock.calls[0][1].streamEvent
        await passedStreamEvent({
            streamKey: 'CHARACTER#Test',
            header: { type: 'Character Moved' },
            update: { type: 'Character Moved' },
        } as any)
        expect(mockPositionsStreamEvent).toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).toHaveBeenCalledWith(expect.objectContaining({
            payload: {
                type: 'MoveCharacter',
                characterId: 'CHARACTER#Test',
                roomId: 'ROOM#TestTwo',
            },
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#TestTwo',
            beatAnchorTime: 1_700_000_000_000,
            messageBus: messageBusMock,
        }))
        expect(ephemeraDBMock.transactWrite).not.toHaveBeenCalled()
    })

    it('skips orchestration when membership apply is a no-op', async () => {
        applyCharacterRoomMembershipMock.mockResolvedValue({
            ok: true,
            froms: ['ROOM#VORTEX'],
            to: 'ROOM#VORTEX',
            changed: false,
        })
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#VORTEX',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{
                type: 'MoveCharacter',
                characterId: 'CHARACTER#Test',
                roomId: 'ROOM#VORTEX',
                arriveMessage: ' has connected.',
                suppressSelfMessage: true,
            }],
            messageBus: messageBusMock,
        })
        expect(applyCharacterRoomMembershipMock).toHaveBeenCalled()
        expect(orchestrateCharacterNavigateMock).not.toHaveBeenCalled()
    })

    it('should replace items in RoomStack when moved in same asset', async () => {
        const fromRoom = 'ROOM#TestTwo' as EphemeraRoomId
        applyCharacterRoomMembershipMock.mockImplementation(async (args) => {
            const { applyCharacterMembershipFlat } = jest.requireActual('../dataSource/positions/membership/applyCharacterMembershipFlat')
            const flatResult = await applyCharacterMembershipFlat(args, {
                readMembershipEndpoint: async () => fromRoom,
                transactWrite: ephemeraDBMock.transactWrite,
                getCharacterMeta: internalCacheMock.CharacterMeta.get,
                getCharacterSessions: internalCacheMock.CharacterSessions.get,
                getRoomAssets: internalCacheMock.RoomAssets.get,
                getCanonAssets: async () => ['primitives', 'TownCenter'],
            })
            return flatResult.ok && flatResult.changed
                ? { ...flatResult, beatAnchorTime: 1_700_000_000_000 }
                : flatResult
        })
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }],
            'ROOM#TestThree',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestThree' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestTwo', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestThree',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestThree' }
                ]
            })
        }
    })

    it('should add items to RoomStack when moved into a child asset', async () => {
        const fromRoom = 'ROOM#TestTwo' as EphemeraRoomId
        applyCharacterRoomMembershipMock.mockImplementation(async (args) => {
            const { applyCharacterMembershipFlat } = jest.requireActual('../dataSource/positions/membership/applyCharacterMembershipFlat')
            const flatResult = await applyCharacterMembershipFlat(args, {
                readMembershipEndpoint: async () => fromRoom,
                transactWrite: ephemeraDBMock.transactWrite,
                getCharacterMeta: internalCacheMock.CharacterMeta.get,
                getCharacterSessions: internalCacheMock.CharacterSessions.get,
                getRoomAssets: internalCacheMock.RoomAssets.get,
                getCanonAssets: async () => ['primitives', 'TownCenter'],
            })
            return flatResult.ok && flatResult.changed
                ? { ...flatResult, beatAnchorTime: 1_700_000_000_000 }
                : flatResult
        })
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }],
            'ROOM#TestFour',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestFour' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestTwo', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestFour',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestTwo' },
                    { asset: 'draftOne', RoomId: 'TestFour' }
                ]
            })
        }
    })

    it('should remove items from RoomStack when moved back to a parent asset', async () => {
        const fromRoom = 'ROOM#TestFour' as EphemeraRoomId
        applyCharacterRoomMembershipMock.mockImplementation(async (args) => {
            const { applyCharacterMembershipFlat } = jest.requireActual('../dataSource/positions/membership/applyCharacterMembershipFlat')
            const flatResult = await applyCharacterMembershipFlat(args, {
                readMembershipEndpoint: async () => fromRoom,
                transactWrite: ephemeraDBMock.transactWrite,
                getCharacterMeta: internalCacheMock.CharacterMeta.get,
                getCharacterSessions: internalCacheMock.CharacterSessions.get,
                getRoomAssets: internalCacheMock.RoomAssets.get,
                getCanonAssets: async () => ['primitives', 'TownCenter'],
            })
            return flatResult.ok && flatResult.changed
                ? { ...flatResult, beatAnchorTime: 1_700_000_000_000 }
                : flatResult
        })
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }, { asset: 'draftOne', RoomId: 'TestFour' }],
            'ROOM#TestOne',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestOne' }],
            messageBus: messageBusMock
        })
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#TestFour', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'TestTwo' }, { asset: 'draftOne', RoomId: 'TestFour' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestOne',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'TestOne' }
                ]
            })
        }
    })

})
