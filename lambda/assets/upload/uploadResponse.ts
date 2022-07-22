import { splitType } from '@tonylb/mtw-utilities/dist/types'

import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB/index"
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { SocketQueue } from "@tonylb/mtw-utilities/dist/apiManagement/index"

import internalCache from "../internalCache"
import { MessageBus, UploadResponseMessage } from "../messageBus/baseClasses"
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import { CacheUploadSubscriptionItem } from '../internalCache/uploadSubscriptions'

//
// uploadResponse forwards a processing response from an Upload to the players that have
// subscribed to know when it finishes processing.
//
export const uploadResponse = async ({ uploadId, ...rest }) => {
    const Items = await assetDB.query({
        AssetId: `UPLOAD#${uploadId}`,
        ProjectionFields: ['DataCategory', 'RequestId']
    })
    const playerNames = Items
        .map(({ DataCategory, RequestId }) => ({ PlayerName: splitType(DataCategory)[1], RequestId }))
    await Promise.all(playerNames
        .map(async ({ PlayerName, RequestId }) => {
            const connections = await internalCache.UploadSubscriptions.get(PlayerName)
            await Promise.all([
                ...(connections || [])
                    .map(async (ConnectionId) => {
                        const socketQueue = new SocketQueue()
                        socketQueue.send({
                            ConnectionId, 
                            Message: {
                                ...rest,
                                RequestId
                            }
                        })
                        await socketQueue.flush()
                    }),
                assetDB.deleteItem({
                    AssetId: `UPLOAD#${uploadId}`,
                    DataCategory: `PLAYER#${PlayerName}`
                })
            ])
        }))
}

export const uploadResponseMessage = async ({ payloads, messageBus }: { payloads: UploadResponseMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async (payload) => {
            const subscriptions = (await internalCache.UploadSubscriptions.get(payload.uploadId)) || []
            await Promise.all([
                ...(subscriptions
                    .map(async (subscription) => {
                        await Promise.all((subscription.connections || [])
                            .map(async (ConnectionId) => {
                                await apiClient.send({
                                    ConnectionId,
                                    Data: JSON.stringify({
                                        messageType: payload.messageType,
                                        operation: 'Upload',
                                        RequestId: subscription.RequestId
                                    })
                                })
                            })
                        )
                    })
                ),
                //
                // TODO: Replace the below (which only unique-checks within a given upload message)
                // with something in the next promise out, which reduces all of the found players after
                // running the internalCache gets, and then runs unique across the whole batch
                //
                ...((unique(subscriptions) || []) as CacheUploadSubscriptionItem[])
                    .map(({ player }) => (player))
                    .map((player) => (assetDB.deleteItem({
                        AssetId: `UPLOAD#${payload.uploadId}`,
                        DataCategory: `PLAYER#${player}`
                    }))
                )
            ])
        })
    )
}

export default uploadResponse