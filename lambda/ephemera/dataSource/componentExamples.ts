import EphemeraDataSource from './abstract'
import {
    ComponentExamplesMirrorEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import {
    HeaderGuard,
    StreamingEventEnvelope,
    StreamingEventHeader,
    makeStreamingEnvelopeGuardFromHeaderGuard
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCacheComponentId, EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { PutCacheRecordInput } from './renderCache/putCacheRecord'
import internalCache, { type InternalCache } from '../internalCache'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
    isEphemeraSituationId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { sendPutCacheRecord, sendDeleteCacheRecords } from './apiEphemera'
import messageBus from '../messageBus'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export type EphemeraExamplesIncomingEvent = StreamingEventEnvelope<ComponentExamplesMirrorEvent> & {
    header: StreamingEventHeader & {
        dataSourceKey: 'mtw.assets.componentExamples';
        type: 'ExampleAdded' | 'ExampleUpdated' | 'ExampleRemoved';
    };
}

type EphemeraExamplesSubscribedHeader = EphemeraExamplesIncomingEvent['header']

const isEphemeraExamplesHeader: HeaderGuard<EphemeraExamplesSubscribedHeader> = (
    header
): header is EphemeraExamplesSubscribedHeader =>
    header.dataSourceKey === 'mtw.assets.componentExamples' &&
    (header.type === 'ExampleAdded' ||
        header.type === 'ExampleUpdated' ||
        header.type === 'ExampleRemoved')

export const isEphemeraExamplesEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
ComponentExamplesMirrorEvent,
EphemeraExamplesSubscribedHeader
>(isEphemeraExamplesHeader)

type Logger = {
    error?: (message: string, details?: Record<string, unknown>) => void;
}

/** Only `send` is required: nested `StreamingEvent` posts are drained by the in-progress `flush()` recursion. */
export type ComponentExamplesMessageBus = {
    send: (payload: StreamingEventMessage) => void;
}

export type HandleComponentExamplesDependencies = {
    internalCacheOverride?: InternalCache;
    messageBus: ComponentExamplesMessageBus;
    computePerspectiveKey: typeof computePerspectiveKey;
    logger?: Logger;
}

const isEphemeraCacheComponentId = (value: string): value is EphemeraCacheComponentId =>
    isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraKnowledgeId(value)

const defaultDependencies: HandleComponentExamplesDependencies = {
    messageBus,
    computePerspectiveKey,
    logger: console
}

export const handleComponentExamplesEvent = async (
    event: ComponentExamplesMirrorEvent,
    dependencies: HandleComponentExamplesDependencies = defaultDependencies
): Promise<void> => {
    const {
        internalCacheOverride,
        messageBus: bus,
        computePerspectiveKey: computeKey,
        logger
    } = dependencies

    const { exampleId, parentIds, assetStack } = event
    const getCache = () => internalCacheOverride ?? internalCache

    if (!parentIds.length) {
        return
    }

    if (event.type === 'ExampleAdded' || event.type === 'ExampleUpdated') {
        const perspectiveId = computeKey(assetStack)
        const { example } = event
        if (!example) {
            return
        }

        const record: PutCacheRecordInput = {
            markState: example.markState,
            renderedContent: example.renderedContent,
            provenance: example.provenance,
            perspectiveId,
            perspectiveMatcher: event.perspectiveMatcher,
            ...(isEphemeraSituationId(exampleId) ? { situationId: exampleId } : { authoredExampleId: exampleId })
        }

        await Promise.all(
            parentIds
                .filter(isEphemeraCacheComponentId)
                .map(async (parentId) => {
                    try {
                        const perspective = { assetStack }
                        const existing = await getCache().RenderCache.getExactMatch({
                            componentId: parentId,
                            proposedMarkState: example.markState,
                            perspective
                        })
                        sendPutCacheRecord(bus, parentId, {
                            componentId: parentId,
                            record,
                            ...(existing?.DataCategory !== undefined
                                ? { existingDataCategory: existing.DataCategory }
                                : {}),
                        })
                    } catch (error) {
                        if (logger?.error) {
                            logger.error('Failed to write ephemera cache record from ComponentExamples event', {
                                error,
                                parentId,
                                exampleId,
                                perspectiveId
                            })
                        }
                    }
                })
        )
        return
    }

    if (event.type === 'ExampleRemoved') {
        await Promise.all(
            parentIds
                .filter(isEphemeraCacheComponentId)
                .map(async (parentId) => {
                    try {
                        const records = await getCache().RenderCache.get(parentId)
                        const matches = records.filter(
                            (item: EphemeraCacheDynamoItem) =>
                                item.situationId === exampleId || item.authoredExampleId === exampleId
                        )
                        const dataCategories = matches.map((item) => item.DataCategory)
                        if (dataCategories.length > 0) {
                            sendDeleteCacheRecords(bus, parentId, {
                                componentId: parentId,
                                dataCategories,
                            })
                        }
                    } catch (error) {
                        if (logger?.error) {
                            logger.error('Failed to delete ephemera cache records from ExampleRemoved event', {
                                error,
                                parentId,
                                exampleId
                            })
                        }
                    }
                })
        )
    }
}

export const ephemeraExamplesDataSource = new EphemeraDataSource<
never,
never,
ComponentExamplesMirrorEvent
>({
    dataSourceKey: 'mtw.ephemera.examples',
    replayable: false,
    subscribedEventTypeGuard: isEphemeraExamplesEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(
            events.map(async (event) => {
                const content = await event.getContent()
                if (!content) {
                    return
                }
                await handleComponentExamplesEvent(content)
            })
        )
    }
})

ephemeraExamplesDataSource.subscribe()

export default ephemeraExamplesDataSource
