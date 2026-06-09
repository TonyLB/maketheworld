jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import * as roomHeaderBroadcastModule from './kickRoomHeaderBroadcast'
import { handleAffordancesPertain } from './handleAffordancesPertain'

describe('handleAffordancesPertain', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        internalCache.clear()
    })

    function makePayload() {
        const { roomId, perspective, perspectiveKey } = affordancePassThroughFixtureRouting
        const affordanceRow = createAffordanceCacheRow({
            roomId,
            perspectiveKey,
            assetStack: perspective.assetStack,
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: {
                roomUniversalKey: roomId,
                exits: [{ reference: { tag: 'Room', universalKey: 'ROOM#east' }, payload: 'east' }],
            },
        })
        return {
            type: 'Affordances Pertain' as const,
            roomId,
            perspective,
            perspectiveKey,
            affordanceRow,
            topology: affordanceRow.topology,
        }
    }

    it('publishes affordance PerceptionMessage to SESSION# when sessionOrientationAffordances thread registered', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        const rosterSpy = jest.spyOn(internalCache.RoomCharacterList, 'get')
        const stackMergeSpy = jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        internalCache.PerceptionThreads.register({
            threadKind: 'sessionOrientationAffordances',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#Viewer',
            targets: ['SESSION#test-session'],
        })

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(1)
        const row = affordancePublishes[0][0] as {
            targets?: string[];
            messageId?: string;
            wmlContent?: string;
        }
        expect(row.targets).toEqual(['SESSION#test-session'])
        expect(row.wmlContent).toBe('<AffordanceHeader />')
        expect(row.messageId).toMatch(/^MESSAGE#/)
        expect(stackMergeSpy).toHaveBeenCalledTimes(1)
        expect(stackMergeSpy).toHaveBeenCalledWith('CHARACTER#Viewer', passThroughFixtureRoomId)
        expect(rosterSpy).not.toHaveBeenCalled()
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        stackMergeSpy.mockRestore()
        schemaSpy.mockRestore()
        sendSpy.mockRestore()
        rosterSpy.mockRestore()
    })

    it('publishes affordance PerceptionMessage for perspective-matched occupants only', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#Match', DisplayName: 'Match', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#Other', DisplayName: 'Other', Color: 'purple', SessionIds: [] },
        ])
        jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockImplementation(async (_roomId, assets) => (
                (assets || []).includes('match') ? passThroughFixturePerspectiveKey : 'DIFFERENT#Perspective'
            ))
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockImplementation(async (characterId) => ({
                EphemeraId: characterId,
                assets: characterId === 'CHARACTER#Match' ? ['match'] : ['other'],
            } as any))
        const stackMergeSpy = jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string; displayMode?: string; componentUUID?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(1)
        const row = affordancePublishes[0][0] as {
            targets?: string[];
            metaData?: { displayMode?: string; componentUUID?: string };
            messageId?: string;
            wmlContent?: string;
        }
        expect(row.targets).toEqual(['CHARACTER#Match'])
        expect(row.metaData?.displayMode).toBe('header')
        expect(row.metaData?.componentUUID).toBe(passThroughFixtureRoomId)
        expect(row.wmlContent).toBe('<AffordanceHeader />')
        expect(row.messageId).toMatch(/^MESSAGE#/)
        expect(stackMergeSpy).toHaveBeenCalledTimes(1)
        expect(stackMergeSpy).toHaveBeenCalledWith('CHARACTER#Match', passThroughFixtureRoomId)

        stackMergeSpy.mockRestore()
        schemaSpy.mockRestore()
        sendSpy.mockRestore()
    })

    it('does not publish when no occupants match perspective key', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#A', DisplayName: 'A', Color: 'blue', SessionIds: [] },
        ])
        jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockResolvedValue('DIFFERENT#Perspective')
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockResolvedValue({ EphemeraId: 'CHARACTER#A', assets: ['other'] } as any)

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(0)

        sendSpy.mockRestore()
    })

    it('does not publish when room has no occupants', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = sendSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(0)

        sendSpy.mockRestore()
    })

    it('uses distinct messageId per matching occupant', async () => {
        const sendSpy = jest.spyOn(messageBus, 'send')
        jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#One', DisplayName: 'One', Color: 'blue', SessionIds: [] },
            { EphemeraId: 'CHARACTER#Two', DisplayName: 'Two', Color: 'purple', SessionIds: [] },
        ])
        jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockResolvedValue(passThroughFixturePerspectiveKey)
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockImplementation(async (characterId) => ({
                EphemeraId: characterId,
                assets: ['match'],
            } as any))
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        await handleAffordancesPertain(makePayload(), messageBus)

        const messageIds = sendSpy.mock.calls
            .filter((c) => {
                const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
                return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
            })
            .map((c) => (c[0] as { messageId?: string }).messageId)
        expect(messageIds).toHaveLength(2)
        expect(new Set(messageIds).size).toBe(2)

        sendSpy.mockRestore()
    })
})
