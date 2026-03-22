/**
 * mtw.ephemera.renderCache: consumes api.ephemera Put Cache Record and Delete Cache Records,
 * writes via putCacheRecord / deleteCacheRecord, publishes Cache Updated / Cache Deleted / Cache Error
 * on the internal bus (bus-only, non-replayable).
 */
import EphemeraDataSource from '../abstract'
import {
    isEphemeraApiPutCacheRecordEnvelope,
    isEphemeraApiDeleteCacheRecordsEnvelope
} from '../apiEphemera'
import type { DeleteCacheRecordsCommand, PutCacheRecordCommand } from '../localApiEvents'
import { isDeleteCacheRecordsCommand, isPutCacheRecordCommand } from '../localApiEvents'
import { putCacheRecord } from './putCacheRecord'
import { deleteCacheRecord } from './deleteCacheRecord'
import type { EphemeraCacheComponentId } from '../../renderCache/baseClasses'
import internalCache from '../../internalCache'
import type { RenderCacheUpdatePayload } from './baseClasses'

type CacheCommand = PutCacheRecordCommand | DeleteCacheRecordsCommand

const isPutOrDeleteCacheCommandEnvelope = (envelope: any): envelope is any => (
    isEphemeraApiPutCacheRecordEnvelope(envelope) || isEphemeraApiDeleteCacheRecordsEnvelope(envelope)
)

export const ephemeraRenderCacheDataSource = new EphemeraDataSource<never, RenderCacheUpdatePayload, CacheCommand>({
    dataSourceKey: 'mtw.ephemera.renderCache',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isPutOrDeleteCacheCommandEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (evt) => {
                const streamKey = evt.header.streamKey
                let componentId: EphemeraCacheComponentId = streamKey as EphemeraCacheComponentId
                let perspectiveId: string | undefined
                let opErrorCode: string | undefined
                try {
                    const cmd = await (evt as any).getContent() as CacheCommand
                    if (isPutCacheRecordCommand(cmd)) {
                        opErrorCode = 'PUT_FAILED'
                        componentId = cmd.componentId
                        perspectiveId = cmd.record.perspectiveId
                        const dataCategory = await putCacheRecord(cmd.componentId, cmd.record, cmd.existingDataCategory)
                        const { record } = cmd
                        internalCache.RenderCache.set({
                            componentId: cmd.componentId,
                            markState: record.markState,
                            cacheId: dataCategory,
                            renderedContent: record.renderedContent,
                            provenance: record.provenance,
                            perspectiveId: record.perspectiveId,
                            perspectiveMatcher: record.perspectiveMatcher,
                            ...(record.situationId !== undefined ? { situationId: record.situationId } : {}),
                            ...(record.authoredExampleId !== undefined ? { authoredExampleId: record.authoredExampleId } : {}),
                        })
                        await streamEvent({
                            streamKey: cmd.componentId,
                            header: { type: 'Cache Updated' },
                            update: {
                                type: 'Cache Updated',
                                componentId: cmd.componentId,
                                dataCategory,
                                perspectiveId: cmd.record.perspectiveId,
                                ...(cmd.conversationId !== undefined ? { conversationId: cmd.conversationId } : {}),
                            },
                        })
                        return
                    }

                    if (isDeleteCacheRecordsCommand(cmd)) {
                        opErrorCode = 'DELETE_FAILED'
                        componentId = cmd.componentId
                        await Promise.all(
                            cmd.dataCategories.map((dataCategory) =>
                                deleteCacheRecord(cmd.componentId, dataCategory)
                            )
                        )
                        internalCache.RenderCache.deleteCacheRecords(cmd.componentId, cmd.dataCategories)
                        await streamEvent({
                            streamKey: cmd.componentId,
                            header: { type: 'Cache Deleted' },
                            update: {
                                type: 'Cache Deleted',
                                componentId: cmd.componentId,
                                dataCategories: cmd.dataCategories,
                            },
                        })
                        return
                    }

                    const invalidPayloadMessage = 'api.ephemera cache command failed validation'
                    console.error('[mtw.ephemera.renderCache] Cache Error', {
                        componentId,
                        errorCode: 'INVALID_PAYLOAD',
                        errorMessage: invalidPayloadMessage,
                    })
                    await streamEvent({
                        streamKey,
                        header: { type: 'Cache Error' },
                        update: {
                            type: 'Cache Error',
                            componentId,
                            errorCode: 'INVALID_PAYLOAD',
                            errorMessage: invalidPayloadMessage,
                        },
                    })
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    const errorCode = opErrorCode ?? 'CACHE_COMMAND_FAILED'
                    console.error('[mtw.ephemera.renderCache] Cache Error', {
                        componentId,
                        errorCode,
                        errorMessage,
                        ...(perspectiveId !== undefined ? { perspectiveId } : {}),
                    })
                    await streamEvent({
                        streamKey: componentId,
                        header: { type: 'Cache Error' },
                        update: {
                            type: 'Cache Error',
                            componentId,
                            errorCode,
                            errorMessage,
                            ...(perspectiveId !== undefined ? { perspectiveId } : {}),
                        },
                    })
                }
            })
        )
    },
})

ephemeraRenderCacheDataSource.subscribe()

export default ephemeraRenderCacheDataSource
