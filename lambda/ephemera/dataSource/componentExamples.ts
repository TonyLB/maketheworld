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
import {
    queryCacheRecordsForComponent,
    putCacheRecord,
    deleteCacheRecord,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheComponentId,
    type PutCacheRecordInput,
    findExactMatch
} from '../renderCache'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
    isEphemeraSituationId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveId } from '../internalUtils/perspectiveId'

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

export type HandleComponentExamplesDependencies = {
    queryCacheRecordsForComponent: typeof queryCacheRecordsForComponent;
    putCacheRecord: typeof putCacheRecord;
    deleteCacheRecord: typeof deleteCacheRecord;
    computePerspectiveId: typeof computePerspectiveId;
    logger?: Logger;
}

const isEphemeraCacheComponentId = (value: string): value is EphemeraCacheComponentId =>
    isEphemeraRoomId(value) || isEphemeraFeatureId(value) || isEphemeraKnowledgeId(value)

const defaultDependencies: HandleComponentExamplesDependencies = {
    queryCacheRecordsForComponent,
    putCacheRecord,
    deleteCacheRecord,
    computePerspectiveId,
    logger: console
}

export const handleComponentExamplesEvent = async (
    event: ComponentExamplesMirrorEvent,
    dependencies: HandleComponentExamplesDependencies = defaultDependencies
): Promise<void> => {
    const {
        queryCacheRecordsForComponent: queryRecords,
        putCacheRecord: putRecord,
        deleteCacheRecord: deleteRecord,
        computePerspectiveId: computeId,
        logger
    } = dependencies

    const { exampleId, parentIds, assetStack } = event

    if (!parentIds.length) {
        return
    }

    if (event.type === 'ExampleAdded' || event.type === 'ExampleUpdated') {
        const perspectiveId = computeId(assetStack)
        const { example } = event
        if (!example) {
            return
        }

        const record: PutCacheRecordInput = {
            markState: example.markState,
            renderedContent: example.renderedContent,
            provenance: example.provenance,
            perspectiveId,
            ...(isEphemeraSituationId(exampleId) ? { situationId: exampleId } : { authoredExampleId: exampleId })
        }

        await Promise.all(
            parentIds
                .filter(isEphemeraCacheComponentId)
                .map(async (parentId) => {
                    try {
                        const existingRecords = await queryRecords(parentId)
                        const existing = findExactMatch({
                            componentId: parentId,
                            proposedMarkState: example.markState,
                            records: existingRecords,
                            perspectiveId
                        })
                        await putRecord(parentId, record, existing?.DataCategory)
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
                        const records = await queryRecords(parentId)
                        const matches = records.filter(
                            (item: EphemeraCacheDynamoItem) =>
                                item.situationId === exampleId || item.authoredExampleId === exampleId
                        )
                        await Promise.all(
                            matches.map((item) => deleteRecord(parentId, item.DataCategory))
                        )
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

