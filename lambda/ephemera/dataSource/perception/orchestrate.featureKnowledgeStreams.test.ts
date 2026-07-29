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
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import {
    passThroughFixtureAuthoredEmptyMarksDynamoItem,
    passThroughFixtureFeatureId,
    passThroughFixtureKnowledgeId,
    passThroughFixtureMinimalCacheId,
    passThroughFixturePerspective,
    passThroughFixturePerspectiveKey,
} from '../passThroughContractFixtures'
import { orchestrateRoomDescriptionStreams } from './orchestrate'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'

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

function spyPublish() {
    return jest.spyOn(messageBus, 'publish')
}

type PublishMessageLike = {
    type?: string;
    metaData?: { status?: string; componentUUID?: string };
    wmlContent?: string;
    targets?: unknown[];
    messageId?: string;
    createdTime?: number;
}

function findPublishMessage(
    spy: ReturnType<typeof spyPublish>,
    predicate: (msg: PublishMessageLike) => boolean
): PublishMessageLike | undefined {
    const match = spy.mock.calls.find((call) => {
        const msg = call[0] as PublishMessageLike
        return msg?.type === 'PublishMessage' && predicate(msg)
    })
    return match ? (match[0] as PublishMessageLike) : undefined
}

/** Declares a one-slot bundle and registers its ingress listener --- the Phase 7 feature/knowledge equivalent of dataSource/perception/index.test.ts's declareCharacterMoveBundle/registerCharacterMoveIngress. */
async function registerRenderSlot(componentId: string, perspectiveKey: string, targets: string[] = [VIEWER]): Promise<string> {
    const bundleId = uuidv4()
    const slotId = 'slot'
    sendMessageBundleDeclared(messageBus, bundleId, {
        bundleId,
        slots: [{ slotId, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(messageBus, bundleId, {
        slotId,
        expectedPublishType: 'PerceptionMessage',
        componentId: componentId as any,
        perspectiveKey,
        targets: targets as any,
        contentStream: 'render',
        format: 'full',
    })
    return bundleId
}

describe('orchestrateRoomDescriptionStreams feature/knowledge fan-in', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        let timestamp = 1_000_000_000_000
        mockGetCurrentTimestamp.mockImplementation(() => timestamp++)
        internalCache.clear()
        messageBus.clear()
    })

    it('featureDescription Generation Started reports a Generating placeholder to the registered listener', async () => {
        const publishSpy = spyPublish()
        await registerRenderSlot(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        const genPublish = findPublishMessage(publishSpy, (m) => m.metaData?.status === 'generating')
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
        expect(genPublish?.messageId).toMatch(/^MESSAGE#/)
    })

    it('featureDescription Render Pertains terminal overwrites the placeholder with a stable messageId', async () => {
        const publishSpy = spyPublish()
        await registerRenderSlot(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        const genPublish = findPublishMessage(publishSpy, (m) => m.metaData?.status === 'generating')
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
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = findPublishMessage(
            publishSpy,
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
    })

    it('knowledgeDescription delivers to whatever targets the listener registered (SESSION# resolution now happens at registration, in handleLookCommandRequestedForRenderOrchestration.ts)', async () => {
        const publishSpy = spyPublish()
        const MOCK_SESSION_ID = 'sess-test-123'
        await registerRenderSlot(passThroughFixtureKnowledgeId, passThroughFixturePerspectiveKey, [`SESSION#${MOCK_SESSION_ID}`])

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Render Pertains',
                componentId: passThroughFixtureKnowledgeId,
                perspectiveKey: passThroughFixturePerspectiveKey,
                cacheId: passThroughFixtureMinimalCacheId,
                cacheRecord: knowledgeTerminalCacheRecord(),
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        const terminalPublish = findPublishMessage(publishSpy, () => true)
        expect(terminalPublish?.targets).toEqual([`SESSION#${MOCK_SESSION_ID}`])
        expect(terminalPublish?.metaData).toEqual({ componentUUID: passThroughFixtureKnowledgeId })
        assertKnowledgeRenderDescription(
            terminalPublish!.wmlContent as string,
            passThroughFixtureKnowledgeId,
            'Test description.'
        )
    })

    it('featureDescription Orchestration Error delivers an Error placeholder', async () => {
        const publishSpy = spyPublish()
        await registerRenderSlot(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Orchestration Error',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        const errPublish = findPublishMessage(publishSpy, () => true)
        expect(errPublish).toBeDefined()
        assertFeatureRenderDescription(
            errPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Error'
        )
    })

    it('featureDescription Generation Deferred delivers an Error placeholder', async () => {
        const publishSpy = spyPublish()
        await registerRenderSlot(passThroughFixtureFeatureId, passThroughFixturePerspectiveKey)

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Deferred',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                reason: 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN',
                policy: 'costCap',
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        const defPublish = findPublishMessage(publishSpy, () => true)
        expect(defPublish).toBeDefined()
        assertFeatureRenderDescription(
            defPublish!.wmlContent as string,
            passThroughFixtureFeatureId,
            'Error'
        )
    })

    it('with no registered listener, reports content to zero listeners and publishes nothing', async () => {
        const publishSpy = spyPublish()

        await orchestrateRoomDescriptionStreams(
            {
                type: 'Generation Started',
                componentId: passThroughFixtureFeatureId,
                perspective: passThroughFixturePerspective,
                perspectiveKey: passThroughFixturePerspectiveKey,
                phase: 'generating',
            },
            messageBus
        )
        await messageBus.flushAndSettle()

        expect(publishSpy.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'PublishMessage')).toHaveLength(0)
    })
})
