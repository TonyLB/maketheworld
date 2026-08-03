/**
 * Cross-layer integration: `mtw.connections` / `Character Registered` alone (no `Character Connected`)
 * delivers render + affordance `PublishMessage` rows to `CHARACTER#...` through real DataSource
 * subscribers on the process message bus (orientation kick -> orchestration -> cache -> perception).
 *
 * Mocks: Dynamo/cache I/O, `publishMessage` write-through, `generateRoomPreview` (deterministic
 * Generation Started + Render Generated). Does not import positions / `mtw.connections.characters`.
 */
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./renderCache/putCacheRecord', () => ({
    __esModule: true,
    putCacheRecord: jest.fn(),
}))

jest.mock('./renderCache/ensureAuthoredCatalog', () => ({
    ensureAuthoredCatalog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./renderCache/catalogRow', () => ({
    ...jest.requireActual('./renderCache/catalogRow'),
    getCatalogRow: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./renderCache/perspectivePointer', () => ({
    resolvePerspectivePointer: jest.fn().mockResolvedValue(undefined),
    clearPerspectivePointer: jest.fn().mockResolvedValue(undefined),
    collectPerspectivePointerEntries: jest.fn().mockResolvedValue([]),
}))

jest.mock('./renderOrchestration/generateRoomPreview', () => ({
    generateRoomPreview: jest.fn(),
}))

jest.mock('./affordanceCache/ensureAffordanceTopology', () => ({
    ensureAffordanceTopology: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./affordanceCache/catalogRow', () => ({
    ...jest.requireActual('./affordanceCache/catalogRow'),
    getAffordanceRow: jest.fn(),
}))

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import * as perspectiveModule from '@tonylb/mtw-interfaces/ts/perspective'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import * as schemaModule from '@tonylb/mtw-wml/ts/schema'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { isPublishMessage } from '../messageBus/baseClasses'
import { getAffordanceRow } from './affordanceCache/catalogRow'
import { putCacheRecord } from './renderCache/putCacheRecord'
import {
    generateRoomPreview,
    type GenerateRoomPreviewOptions,
} from './renderOrchestration/generateRoomPreview'
import * as kickRoomHeaderBroadcastModule from './perception/kickRoomHeaderBroadcast'
import * as resolveCharacterRoomIdModule from './positions/membership/resolveCharacterRoomId'
import {
    makePassThroughGenerationStartedPayload,
    makePassThroughRenderGeneratedPayload,
    passThroughFixtureMinimalCacheId,
    passThroughFixtureMinimalDynamoItem,
    passThroughFixturePerspective,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from './passThroughContractFixtures'

import './perception/index'
import './renderOrchestration/index'
import './renderCache/index'
import './affordanceOrchestration/index'
import './affordanceCache/index'

const originalMessageBusPublish = messageBus.publish.bind(messageBus)
const mockedPutCacheRecord = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const getAffordanceRowMock = getAffordanceRow as jest.MockedFunction<typeof getAffordanceRow>
const generateRoomPreviewMock = generateRoomPreview as jest.MockedFunction<typeof generateRoomPreview>

const characterId = 'CHARACTER#viewer' as EphemeraCharacterId

const characterRegisteredEvent: ConnectionsCharacterRegisteredEvent = {
    type: 'Character Registered',
    characterId,
    sessionId: 'session-1',
    timestamp: '2026-01-01T00:00:00.000Z',
}

function sendCharacterRegisteredEvent(event: ConnectionsCharacterRegisteredEvent): void {
    const timestamp = Date.now()
    const streamKey = event.characterId
    messageBus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'mtw.connections',
        streamKey,
        timestamp,
        header: {
            dataSourceKey: 'mtw.connections',
            streamKey,
            timestamp,
            type: 'Character Registered',
        },
        getContent: async () => event,
    })
}

async function flushOrientationBus(rounds = 6): Promise<void> {
    for (let i = 0; i < rounds; i += 1) {
        await messageBus.flushAndSettle()
    }
}

type PublishMessagePayload = {
    type: 'PublishMessage';
    targets?: string[];
    messageId?: string;
    wmlContent?: string;
    metaData?: {
        roomChannel?: string;
        displayMode?: string;
        status?: string;
    };
}

function publishMessagesFromSpy(publishSpy: jest.SpyInstance): PublishMessagePayload[] {
    return publishSpy.mock.calls
        .map((call) => call[0])
        .filter((payload): payload is PublishMessagePayload => isPublishMessage(payload))
}

describe('Character Registered session orientation (integration)', () => {
    const fixtureMetaRoom: EphemeraMetaRoom = {
        EphemeraId: passThroughFixtureRoomId,
        DataCategory: 'Meta::Room',
        state: { marks: passThroughFixtureMinimalDynamoItem.markState },
    }

    const affordanceRow = createAffordanceCacheRow({
        roomId: passThroughFixtureRoomId,
        perspectiveKey: passThroughFixturePerspectiveKey,
        assetStack: passThroughFixturePerspective.assetStack,
        catalogVersion: 1,
        hydratedCatalogVersion: 1,
        topology: {
            roomUniversalKey: passThroughFixtureRoomId,
            exits: [
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#east' },
                    payload: 'east',
                },
            ],
        },
    })

    beforeEach(() => {
        messageBus.clear()
        internalCache.clear()
        jest.clearAllMocks()

        jest.spyOn(perspectiveModule, 'computePerspectiveKey').mockReturnValue(passThroughFixturePerspectiveKey)
        jest.spyOn(kickRoomHeaderBroadcastModule, 'resolveCharacterRoomPerspectiveForRoom').mockResolvedValue({
            perspective: passThroughFixturePerspective,
            perspectiveKey: passThroughFixturePerspectiveKey,
        })
        jest.spyOn(resolveCharacterRoomIdModule, 'resolveCharacterRoomId').mockResolvedValue(passThroughFixtureRoomId)
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            assets: ['ASSET#one'],
        } as unknown as Awaited<ReturnType<typeof internalCache.CharacterMeta.get>>)
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(fixtureMetaRoom)
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([passThroughFixtureMinimalDynamoItem])
        jest.spyOn(internalCache.RenderCache, 'getExactMatch').mockResolvedValue(null)
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(affordanceRow)
        jest.spyOn(internalCache.AffordanceRoomDeliverable, 'get').mockResolvedValue({ schema: {} } as any)

        getAffordanceRowMock.mockResolvedValue(affordanceRow)
        mockedPutCacheRecord.mockReset()
        mockedPutCacheRecord.mockResolvedValue(passThroughFixtureMinimalCacheId)

        generateRoomPreviewMock.mockImplementation(async (
            _input,
            options: GenerateRoomPreviewOptions
        ) => {
            await options.publishOrchestration(makePassThroughGenerationStartedPayload())
            await options.publishOrchestration(makePassThroughRenderGeneratedPayload())
            return 'success' as const
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('delivers correlated render and uncoupled affordance PublishMessage rows to CHARACTER# through full bus path', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
        const schemaSpy = jest.spyOn(schemaModule, 'schemaToWML').mockReturnValue('<OrientationWml />')

        sendCharacterRegisteredEvent(characterRegisteredEvent)
        await flushOrientationBus()

        const publishes = publishMessagesFromSpy(publishSpy)
        const characterPublishes = publishes.filter((row) => row.targets?.[0] === characterId)

        const renderGenerating = characterPublishes.find((row) =>
            row.metaData?.roomChannel === 'render'
            && row.metaData?.displayMode === 'header'
            && row.metaData?.status === 'generating'
        )
        const renderTerminal = characterPublishes.find((row) =>
            row.metaData?.roomChannel === 'render'
            && row.metaData?.displayMode === 'header'
            && row.metaData?.status !== 'generating'
        )
        const affordancePublish = characterPublishes.find((row) => row.metaData?.roomChannel === 'affordances')

        expect(renderGenerating).toBeDefined()
        expect(renderTerminal).toBeDefined()
        expect(affordancePublish).toBeDefined()

        const renderMessageId = renderGenerating!.messageId
        expect(renderMessageId).toMatch(/^MESSAGE#/)
        expect(renderTerminal!.messageId).toBe(renderMessageId)

        expect(affordancePublish!.messageId).toMatch(/^MESSAGE#/)
        expect(affordancePublish!.messageId).not.toBe(renderMessageId)
        expect(affordancePublish!.wmlContent).toBe('<OrientationWml />')

        expect(
            publishes.every((row) =>
                !row.targets?.length
                || row.targets.every((target) => target === characterId)
            )
        ).toBe(true)

        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureRoomId, passThroughFixturePerspectiveKey)
        ).toEqual([])

        expect(generateRoomPreviewMock).toHaveBeenCalled()
        expect(mockedPutCacheRecord).toHaveBeenCalled()

        schemaSpy.mockRestore()
        publishSpy.mockRestore()
    })
})
