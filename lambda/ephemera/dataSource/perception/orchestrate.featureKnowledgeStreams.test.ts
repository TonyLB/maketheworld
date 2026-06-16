jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
const mockGetCurrentTimestamp = jest.fn()
jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: () => mockGetCurrentTimestamp(),
}))

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    passThroughFixtureAuthoredEmptyMarksDynamoItem,
    passThroughFixtureFeatureId,
    passThroughFixtureKnowledgeId,
    passThroughFixtureMinimalCacheId,
    passThroughFixturePerspective,
    passThroughFixturePerspectiveKey,
} from '../passThroughContractFixtures'
import { orchestrateRoomDescriptionStreams } from './orchestrate'

const TERMINAL_RENDERED_CONTENT = {
    displayName: ['Terminal title'],
    summary: ['Terminal summary'],
    description: ['Test description.'],
} as const

function featureTerminalCacheRecord() {
    return {
        ...passThroughFixtureAuthoredEmptyMarksDynamoItem(passThroughFixtureFeatureId),
        renderedContent: { ...TERMINAL_RENDERED_CONTENT },
    }
}

function knowledgeTerminalCacheRecord() {
    return {
        ...passThroughFixtureAuthoredEmptyMarksDynamoItem(passThroughFixtureKnowledgeId),
        renderedContent: { ...TERMINAL_RENDERED_CONTENT },
    }
}
const VIEWER = 'CHARACTER#viewer' as const
const MOCK_SESSION_ID = 'sess-test-123'

function makeBusStub(): MessageBus {
    return { publish: jest.fn() } as unknown as MessageBus
}

function assertFeatureRenderDescription(wmlContent: string, featureId: string, expectedDescription: string): void {
    const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
    const feature = parsed.byUniversalId[featureId]
    expect(feature).toBeInstanceOf(StandardFeature)
    expect((feature as StandardFeature).render?.description).toEqual([expectedDescription])
}

function assertKnowledgeRenderDescription(wmlContent: string, knowledgeId: string, expectedDescription: string): void {
    const parsed = new StandardForm(wmlContent, { standardizeMode: 'ephemeraWire' })
    const knowledge = parsed.byUniversalId[knowledgeId]
    expect(knowledge).toBeInstanceOf(StandardKnowledge)
    expect((knowledge as StandardKnowledge).render?.description).toEqual([expectedDescription])
}

function findPublishMessage(
    bus: MessageBus,
    predicate: (msg: {
        type?: string;
        metaData?: { status?: string; componentUUID?: string };
        wmlContent?: string;
        targets?: unknown[];
        messageId?: string;
        createdTime?: number;
    }) => boolean
): {
    type?: string;
    metaData?: { status?: string; componentUUID?: string };
    wmlContent?: string;
    targets?: unknown[];
    messageId?: string;
    createdTime?: number;
} | undefined {
    const publish = bus.publish as jest.Mock
    const match = publish.mock.calls.find((call) => {
        const msg = call[0] as {
            type?: string;
            metaData?: { status?: string; componentUUID?: string };
            wmlContent?: string;
            targets?: unknown[];
            messageId?: string;
            createdTime?: number;
        }
        return msg?.type === 'PublishMessage' && predicate(msg)
    })
    return match ? match[0] : undefined
}

describe('orchestrateRoomDescriptionStreams feature/knowledge fan-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
    })

    it('featureDescription Generation Started publishes Generating placeholder and updates thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'featureDescription',
            componentId: passThroughFixtureFeatureId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            bus
        )

        const genPublish = findPublishMessage(bus, (m) => m.metaData?.status === 'generating')
        expect(genPublish).toBeDefined()
        expect(genPublish?.metaData).toEqual({
            componentUUID: passThroughFixtureFeatureId,
            status: 'generating',
        })
        expect(genPublish?.targets).toEqual([VIEWER])
        assertFeatureRenderDescription(
            genPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Generating'
        )

        const listed = internalCache.PerceptionThreads.list(
            passThroughFixtureFeatureId,
            passThroughFixturePerspectiveKey
        )
        expect(listed[0]?.thread).toMatchObject({
            status: 'Generating',
            createdTime: 1_000_000_000_000,
        })
        expect(listed[0]?.thread.messageId).toMatch(/^MESSAGE#/)
    })

    it('featureDescription Render Pertains terminal overwrites with stable messageId and removes thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'featureDescription',
            componentId: passThroughFixtureFeatureId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            bus
        )

        const genPublish = findPublishMessage(bus, (m) => m.metaData?.status === 'generating')
        const messageId = genPublish?.messageId as string
        const genCreatedTime = genPublish?.createdTime as number

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: passThroughFixtureFeatureId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
                cacheRecord: featureTerminalCacheRecord(),
            },
            bus
        )

        const terminalPublish = findPublishMessage(
            bus,
            (m) => m.metaData?.status !== 'generating' && typeof m.wmlContent === 'string'
        )
        expect(terminalPublish).toBeDefined()
        expect(terminalPublish?.messageId).toBe(messageId)
        expect(terminalPublish?.createdTime as number).toBeGreaterThan(genCreatedTime)
        expect(terminalPublish?.metaData).toEqual({ componentUUID: passThroughFixtureFeatureId })
        expect(terminalPublish?.targets).toEqual([VIEWER])
        assertFeatureRenderDescription(
            terminalPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Test description.'
        )
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)
        ).toEqual([])
    })

    it('knowledgeDescription directResponse targets SESSION# from Global.get(SessionId)', async () => {
        const bus = makeBusStub()
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(MOCK_SESSION_ID)
        internalCache.PerceptionThreads.register({
            threadKind: 'knowledgeDescription',
            componentId: passThroughFixtureKnowledgeId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
            directResponse: true,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: passThroughFixtureKnowledgeId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
                cacheRecord: knowledgeTerminalCacheRecord(),
            },
            bus
        )

        const terminalPublish = findPublishMessage(bus, () => true)
        expect(terminalPublish?.targets).toEqual([`SESSION#${MOCK_SESSION_ID}`])
        expect(terminalPublish?.metaData).toEqual({ componentUUID: passThroughFixtureKnowledgeId })
        assertKnowledgeRenderDescription(
            terminalPublish!.wmlContent as string,
            passThroughFixtureKnowledgeId,
            'Test description.'
        )
    })

    it('featureDescription Orchestration Error publishes Error placeholder and removes thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'featureDescription',
            componentId: passThroughFixtureFeatureId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Orchestration Error',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            },
            bus
        )

        const errPublish = findPublishMessage(bus, () => true)
        expect(errPublish).toBeDefined()
        assertFeatureRenderDescription(
            errPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Error'
        )
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)
        ).toEqual([])
    })

    it('featureDescription Generation Deferred publishes Error placeholder and removes thread', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'featureDescription',
            componentId: passThroughFixtureFeatureId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
        })

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Deferred',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                reason: 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN',
                policy: 'costCap',
            },
            bus
        )

        const defPublish = findPublishMessage(bus, () => true)
        expect(defPublish).toBeDefined()
        assertFeatureRenderDescription(
            defPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Error'
        )
        expect(
            internalCache.PerceptionThreads.list(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)
        ).toEqual([])
    })

    it('skips Generation Started when featureDescription thread is already Terminal', async () => {
        const bus = makeBusStub()
        internalCache.PerceptionThreads.register({
            threadKind: 'featureDescription',
            componentId: passThroughFixtureFeatureId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            characterId: VIEWER,
            registrationId: 'reg-terminal',
        })
        internalCache.PerceptionThreads.update(
            {
                componentId: passThroughFixtureFeatureId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                registrationId: 'reg-terminal',
            },
            {
                threadKind: 'featureDescription',
                status: 'Terminal',
                messageId: 'MESSAGE#prior',
            }
        )

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            bus
        )

        expect((bus.publish as jest.Mock).mock.calls).toHaveLength(0)
    })
})
