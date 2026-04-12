import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/ts/dynamoDB/index'

jest.mock('../internalCache')
import internalCache from '../internalCache'
import PerceptionThreadsData from '../internalCache/perceptionThreads'

jest.mock('../dataSource/renderOrchestration/subscribedEvents', () => {
    const actual = jest.requireActual('../dataSource/renderOrchestration/subscribedEvents') as object
    return {
        ...actual,
        sendRenderRequested: jest.fn(),
    }
})
import { sendRenderRequested } from '../dataSource/renderOrchestration/subscribedEvents'

import moveCharacter, { RoomStackItem } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { EphemeraId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

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
    const messageBusSend = jest.fn()
    const messageBusMock = { send: messageBusSend } as unknown as MessageBus
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        messageBusSend.mockClear()
        mockSendRenderRequested.mockClear()
        internalCacheMock.Global.get.mockImplementation((key) => (key === 'assets' ? Promise.resolve(['primitives', 'TownCenter']) : Promise.resolve('abcdef')) as any),
        internalCacheMock.CharacterSessions.get.mockResolvedValue(['abcdef'])
        internalCacheMock.OrchestrateMessages.newMessageGroup.mockReturnValue('UUID#MessageGroup')
        internalCacheMock.OrchestrateMessages.before.mockReturnValue('UUID#Before')
        internalCacheMock.OrchestrateMessages.after.mockReturnValue('UUID#After')
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

    it('should change rooms appropriately', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#TestTwo',
            assetsIntersectingTestRooms
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestTwo' }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            Update: {
                Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
                updateKeys: ['RoomId', 'RoomStack'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        },
        {
            Update: {
                Key: { EphemeraId: 'ROOM#VORTEX', DataCategory: 'Meta::Room' },
                updateKeys: ['activeCharacters'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        },
        {
            Update: {
                Key: { EphemeraId: 'ROOM#TestTwo', DataCategory: 'Meta::Room' },
                updateKeys: ['activeCharacters'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        }])
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#VORTEX', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'TestTwo',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' },
                    { asset: 'TownCenter', RoomId: 'TestTwo' }
                ]
            })
        }
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#Test',
                Connected: true,
                RoomId: 'ROOM#TestTwo',
                connectionTargets: ['GLOBAL', 'SESSION#abcdef'],
            }]
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#VORTEX', 'CHARACTER#Test'],
            displayProtocol: 'WorldMessage',
            message: ['Test has left.'],
            messageGroupId: 'UUID#Before'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: 'ROOM#VORTEX'
        })
        expect(messageBusSend.mock.calls.filter((c) => (c[0] as { type?: string })?.type === 'Perception')).toHaveLength(0)
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#TestTwo', 'CHARACTER#Test'],
            displayProtocol: 'WorldMessage',
            message: ['Test has arrived.'],
            messageGroupId: 'UUID#After'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: 'ROOM#TestTwo'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'MapUpdate',
            characterId: 'CHARACTER#Test',
            previousRoomId: 'ROOM#VORTEX',
            roomId: 'ROOM#TestTwo'
        })
        expect(mockSendRenderRequested).toHaveBeenCalledTimes(1)
        expect(mockSendRenderRequested).toHaveBeenCalledWith(
            messageBusMock,
            'ROOM#TestTwo',
            expect.objectContaining({
                componentId: 'ROOM#TestTwo',
                characterId: 'CHARACTER#Test',
                perspective: { assetStack: ['ASSET#TownCenter'] },
            })
        )
    })

    it('should handle appearance from disconnected', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#VORTEX',
            ['draftOne', 'draftTwo'],
            true
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#VORTEX', arriveMessage: ' has connected.', suppressSelfMessage: true }],
            messageBus: messageBusMock
        })
        expect(ephemeraDBMock.transactWrite).toHaveBeenCalledWith([{
            Update: {
                Key: { EphemeraId: 'CHARACTER#Test', DataCategory: 'Meta::Character' },
                updateKeys: ['RoomId', 'RoomStack'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        },
        {
            Update: {
                Key: { EphemeraId: 'ROOM#VORTEX', DataCategory: 'Meta::Room' },
                updateKeys: ['activeCharacters'],
                updateReducer: expect.any(Function),
                successCallback: expect.any(Function)
            }
        }])
        const firstTransact = ephemeraDBMock.transactWrite.mock.calls[0][0][0]
        if (!('Update' in firstTransact)) {
            expect('Update' in firstTransact).toBe(true)
        }
        else {
            expect(produce({ RoomId: 'ROOM#VORTEX', RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }] }, firstTransact.Update.updateReducer)).toEqual({
                RoomId: 'VORTEX',
                RoomStack: [
                    { asset: 'primitives', RoomId: 'VORTEX' }
                ]
            })
        }
        expect(messageBusSend).toHaveBeenCalledTimes(5)
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'EphemeraUpdate',
            updates: [{
                type: 'CharacterInPlay',
                CharacterId: 'CHARACTER#Test',
                Connected: true,
                RoomId: 'ROOM#VORTEX',
                connectionTargets: ['GLOBAL', 'SESSION#abcdef'],
            }]
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'Perception',
            characterId: 'CHARACTER#Test',
            ephemeraId: 'ROOM#VORTEX',
            header: true,
            messageGroupId: 'UUID#MessageGroup'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['ROOM#VORTEX', '!CHARACTER#Test'],
            displayProtocol: 'WorldMessage',
            message: ['Test has connected.'],
            messageGroupId: 'UUID#After'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: 'ROOM#VORTEX'
        })
        expect(messageBusSend).toHaveBeenCalledWith({
            type: 'MapUpdate',
            characterId: 'CHARACTER#Test',
            previousRoomId: 'ROOM#VORTEX',
            roomId: 'ROOM#VORTEX'
        })
        expect(mockSendRenderRequested).not.toHaveBeenCalled()
    })

    it('does not kick passive render when filtered asset stack is empty', async () => {
        wrapMocks(
            [{ asset: 'primitives', RoomId: 'VORTEX' }],
            'ROOM#TestTwo',
            []
        )
        await moveCharacter({
            payloads: [{ type: 'MoveCharacter', characterId: 'CHARACTER#Test', roomId: 'ROOM#TestTwo' }],
            messageBus: messageBusMock,
        })
        expect(mockSendRenderRequested).not.toHaveBeenCalled()
    })

    it('should replace items in RoomStack when moved in same asset', async () => {
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