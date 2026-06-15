jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import internalCache from '../../internalCache'
import * as hydrateRoomRoster from '../../internalCache/hydrateRoomRoster'
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
    let logSpy: jest.SpiedFunction<typeof console.log>

    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        internalCache.clear()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        logSpy.mockRestore()
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

    it('publishes affordance PerceptionMessage to CHARACTER# when sessionOrientationAffordances thread registered', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        const rosterSpy = jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList')
        const stackMergeSpy = jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        internalCache.PerceptionThreads.register({
            threadKind: 'sessionOrientationAffordances',
            componentId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: 'CHARACTER#Viewer',
            targets: ['CHARACTER#Viewer'],
        })

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(1)
        const row = affordancePublishes[0][0] as {
            targets?: string[];
            messageId?: string;
            wmlContent?: string;
        }
        expect(row.targets).toEqual(['CHARACTER#Viewer'])
        expect(row.wmlContent).toBe('<AffordanceHeader />')
        expect(row.messageId).toMatch(/^MESSAGE#/)
        expect(stackMergeSpy).toHaveBeenCalledTimes(1)
        expect(stackMergeSpy).toHaveBeenCalledWith(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        expect(rosterSpy).not.toHaveBeenCalled()
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        expect(logSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.perception] handleAffordancesPertain',
            expect.objectContaining({
                deliveryPath: 'sessionOrientationAffordances',
                publishedSessionOrientationAffordances: 1,
                sessionOrientationThreadCount: 1,
            })
        )

        stackMergeSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
        rosterSpy.mockRestore()
    })

    it('publishes affordance PerceptionMessage for perspective-matched occupants only', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
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

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
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
        expect(stackMergeSpy).toHaveBeenCalledWith(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)

        stackMergeSpy.mockRestore()
        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })

    it('does not publish when no occupants match perspective key', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#A', DisplayName: 'A', Color: 'blue', SessionIds: [] },
        ])
        jest.spyOn(roomHeaderBroadcastModule, 'getCharacterRoomPerspectiveKey')
            .mockResolvedValue('DIFFERENT#Perspective')
        jest.spyOn(internalCache.CharacterMeta, 'get')
            .mockResolvedValue({ EphemeraId: 'CHARACTER#A', assets: ['other'] } as any)

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(0)

        publishSpy.mockRestore()
    })

    it('does not publish when room has no occupants', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([])

        await handleAffordancesPertain(makePayload(), messageBus)

        const affordancePublishes = publishSpy.mock.calls.filter((c) => {
            const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
            return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
        })
        expect(affordancePublishes).toHaveLength(0)

        publishSpy.mockRestore()
    })

    it('uses distinct messageId per matching occupant', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')
        jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<AffordanceHeader />')
        jest.spyOn(hydrateRoomRoster, 'getRoomCharacterList').mockResolvedValue([
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
        const stackMergeSpy = jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get')
            .mockResolvedValue({ schema: {} } as any)

        await handleAffordancesPertain(makePayload(), messageBus)

        expect(stackMergeSpy).toHaveBeenCalledTimes(1)
        expect(stackMergeSpy).toHaveBeenCalledWith(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)

        const messageIds = publishSpy.mock.calls
            .filter((c) => {
                const m = c[0] as { type?: string; metaData?: { roomChannel?: string } }
                return m?.type === 'PublishMessage' && m?.metaData?.roomChannel === 'affordances'
            })
            .map((c) => (c[0] as { messageId?: string }).messageId)
        expect(messageIds).toHaveLength(2)
        expect(new Set(messageIds).size).toBe(2)

        publishSpy.mockRestore()
    })
})
