jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from '../renderCache/baseClasses'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'

const CHARACTER_ID = 'CHARACTER#target' as const
const PERSPECTIVE = { assetStack: ['ASSET#one'] } as const
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const CACHE_ID = 'CACHE#fixture-cache-1' as const
const VIEWER = 'CHARACTER#viewer' as const
const SLOT_ID = 'character-slot'

function characterTerminalCacheRecord(): EphemeraCacheDynamoItem {
    return {
        EphemeraId: CHARACTER_ID,
        DataCategory: CACHE_ID,
        markState: { markValue: [] },
        renderedContent: { displayName: ['Target'], summary: ['A stranger.'], description: ['A watchful figure.'] },
        provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
        perspectiveId: 'perspective-id',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] },
    }
}

function assertCharacterDescription(wmlContent: string, characterId: string, expectedDescription: string): void {
    const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
    const character = parsed.byUniversalId[characterId]
    expect(character).toBeInstanceOf(StandardCharacter)
    expect(wmlContent).toMatch(expectedDescription)
}

function spyPublish() {
    return jest.spyOn(messageBus, 'publish')
}

async function registerCharacterDescriptionSlot(targets: string[] = [VIEWER]): Promise<string> {
    const bundleId = uuidv4()
    sendMessageBundleDeclared(messageBus, bundleId, {
        bundleId,
        slots: [{ slotId: SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(messageBus, bundleId, {
        slotId: SLOT_ID,
        expectedPublishType: 'PerceptionMessage',
        componentId: CHARACTER_ID,
        perspectiveKey: PERSPECTIVE_KEY,
        targets: targets as any,
        contentStream: 'render',
        format: 'full',
    })
    return bundleId
}

describe('orchestrateRoomDescriptionStreams character fan-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
    })

    it('characterDescription Generation Started reports a valid Generating placeholder to the registered listener', async () => {
        const publishSpy = spyPublish()
        await registerCharacterDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: CHARACTER_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const genPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage' && m.metaData?.status === 'generating')
        expect(genPublish).toBeDefined()
        expect(genPublish?.metaData).toEqual({ componentUUID: CHARACTER_ID, status: 'generating' })
        expect(genPublish?.targets).toEqual([VIEWER])
        expect(() => new StandardForm(genPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()
    })

    it('characterDescription Render Pertains terminal delivers the resolved prose', async () => {
        const publishSpy = spyPublish()
        await registerCharacterDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: CHARACTER_ID,
                perspectiveKey: PERSPECTIVE_KEY,
                cacheId: CACHE_ID,
                cacheRecord: characterTerminalCacheRecord(),
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(terminalPublish).toBeDefined()
        expect(terminalPublish?.metaData).toEqual({ componentUUID: CHARACTER_ID })
        expect(terminalPublish?.targets).toEqual([VIEWER])
        assertCharacterDescription(terminalPublish!.wmlContent as string, CHARACTER_ID, 'A watchful figure.')
    })

    it('characterDescription Orchestration Error delivers a valid Error placeholder', async () => {
        const publishSpy = spyPublish()
        await registerCharacterDescriptionSlot()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Orchestration Error',
                componentId: CHARACTER_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        const errPublish = publishSpy.mock.calls
            .map((c) => c[0] as any)
            .find((m) => m?.type === 'PublishMessage')
        expect(errPublish).toBeDefined()
        expect(() => new StandardForm(errPublish!.wmlContent as string, { standardizeMode: 'ephemeraWire' })).not.toThrow()
    })

    it('with no registered listener, reports content to zero listeners and publishes nothing', async () => {
        const publishSpy = spyPublish()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: CHARACTER_ID,
                perspective: PERSPECTIVE,
                perspectiveKey: PERSPECTIVE_KEY,
                phase: 'generating',
            } as any,
            messageBus
        )
        await messageBus.flushAndSettle()

        expect(publishSpy.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'PublishMessage')).toHaveLength(0)
    })
})
