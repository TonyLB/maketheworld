/**
 * mtw.ephemera.renderCache: consumes api.ephemera Put Cache Record, writes via putCacheRecord,
 * publishes Cache Updated / Cache Error on the internal bus (bus-only, non-replayable).
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraApiPutCacheRecordEnvelope } from '../apiEphemera'
import type { PutCacheRecordCommand } from '../localApiEvents'
import { isPutCacheRecordCommand } from '../localApiEvents'
import { putCacheRecord } from '../../renderCache/cacheAccess'
import type { EphemeraCacheComponentId } from '../../renderCache/baseClasses'
import type { RenderCacheUpdatePayload } from './baseClasses'

export const ephemeraRenderCacheDataSource = new EphemeraDataSource<never, RenderCacheUpdatePayload, PutCacheRecordCommand>({
    dataSourceKey: 'mtw.ephemera.renderCache',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraApiPutCacheRecordEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(
            events.map(async (evt) => {
                const streamKey = evt.header.streamKey
                let componentId: EphemeraCacheComponentId = streamKey as EphemeraCacheComponentId
                let perspectiveId: string | undefined
                try {
                    const cmd = await evt.getContent()
                    if (!isPutCacheRecordCommand(cmd)) {
                        await streamEvent({
                            streamKey,
                            header: { type: 'Cache Error' },
                            update: {
                                type: 'Cache Error',
                                componentId,
                                errorCode: 'INVALID_PAYLOAD',
                                errorMessage: 'Put Cache Record command failed validation',
                            },
                        })
                        return
                    }
                    componentId = cmd.componentId
                    perspectiveId = cmd.record.perspectiveId
                    const dataCategory = await putCacheRecord(cmd.componentId, cmd.record, cmd.existingDataCategory)
                    await streamEvent({
                        streamKey: cmd.componentId,
                        header: { type: 'Cache Updated' },
                        update: {
                            type: 'Cache Updated',
                            componentId: cmd.componentId,
                            dataCategory,
                            perspectiveId: cmd.record.perspectiveId,
                        },
                    })
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    await streamEvent({
                        streamKey: componentId,
                        header: { type: 'Cache Error' },
                        update: {
                            type: 'Cache Error',
                            componentId,
                            errorCode: 'PUT_FAILED',
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
