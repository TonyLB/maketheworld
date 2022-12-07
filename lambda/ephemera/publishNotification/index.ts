import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isWorldMessage, PublishMessage, MessageBus, isRoomUpdatePublishMessage, isPublishTargetRoom, isPublishTargetCharacter, isPublishTargetExcludeCharacter, PublishTarget, isRoomDescriptionPublishMessage, isFeatureDescriptionPublishMessage, isCharacterDescriptionPublishMessage, PublishNotification, isInformationNotification } from "../messageBus/baseClasses"
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import internalCache from '../internalCache'
import { messageDB, messageDeltaDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { RoomCharacterListItem } from '../internalCache/baseClasses'
import { apiClient } from '../apiClient'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { Notification } from '@tonylb/mtw-interfaces/dist/messages'

const batchNotifications = (notifications: Notification[] = []): Notification[][]  => {
    //
    // API Gateway Websockets deliver a maximum of 32KB per data frame (with a maximum of 128k across multiple frames,
    // but I don't think that's needed for an application with a large number of individually small messages)
    //
    const MAX_BATCH_SIZE = 20000
    const lengthOfNotification = (notification) => (JSON.stringify(notification).length)
    const { batchedNotifications = [], currentBatch = [] } = notifications.reduce<{ batchedNotifications: Notification[][], currentBatch: Notification[], currentLength: number }>((previous, notification) => {
        const newLength = lengthOfNotification(notification)
        const proposedLength = previous.currentLength + newLength
        if (proposedLength > MAX_BATCH_SIZE) {
            return {
                batchedNotifications: [...previous.batchedNotifications, previous.currentBatch],
                currentBatch: [notification],
                currentLength: newLength
            }
        }
        else {
            return {
                batchedNotifications: previous.batchedNotifications,
                currentBatch: [...previous.currentBatch, notification],
                currentLength: proposedLength
            }
        }
    }, { batchedNotifications: [], currentBatch: [], currentLength: 0 })
    return currentBatch.length ? [...batchedNotifications, currentBatch] : batchedNotifications
}

const publishNotificationDynamoDB = async <T extends { NotificationId: string; CreatedTime: number; Targets: string[] }>({ NotificationId, CreatedTime, Targets, ...rest }: T): Promise<void> => {
    await Promise.all(
        Targets
            .map(async (target) => (messageDeltaDB.putItem({
                Target: target,
                DeltaId: `${CreatedTime}::${NotificationId}`,
                RowId: NotificationId,
                CreatedTime,
                ...rest
            })))
    )
}

export const publishNotification = async ({ payloads }: { payloads: PublishNotification[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()

    let dbPromises: Promise<void>[] = []
    let notificationsByConnectionId: Record<string, (Notification & { CreatedTime: number; NotificationId: string; })[]> = {}

    const pushToQueues = async <T extends Omit<Notification, 'Target'> & { Targets: string[]; CreatedTime: number; NotificationId: string; }>({ Targets, ...rest }: T): Promise<void> => {
        dbPromises.push(publishNotificationDynamoDB({
            Targets,
            ...rest
        }))
        await Promise.all(Targets.map(async (target) => {
            const connections = (await internalCache.PlayerConnections.get(target)) || []
            connections.forEach((connectionId) => {
                if (!(connectionId in notificationsByConnectionId)) {
                    notificationsByConnectionId[connectionId] = []
                }
                notificationsByConnectionId[connectionId].push({
                    Target: target,
                    ...rest
                })
            })
        }))
    }

    await Promise.all(payloads.map(async (payload, index) => {
        if (isInformationNotification(payload)) {
            await pushToQueues({
                Targets: payload.targets,
                NotificationId: `NOTIFICATION#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
    }))

    await Promise.all([
        ...dbPromises,
        ...(Object.entries(notificationsByConnectionId)
            .map(async ([ConnectionId, notificationList]) => {
                const sortedNotifications = notificationList
                    .sort(({ CreatedTime: a }, { CreatedTime: b }) => ( a - b ))
                return Promise.all(sortedNotifications.length
                    ? batchNotifications(sortedNotifications).map((notificationBatch) => (
                        apiClient.send(
                            ConnectionId,
                            {
                                messageType: 'Notifications',
                                notifications: notificationBatch
                            }
                        )
                    ))
                    : []
                )
            })
        )
    ])
}

export default publishNotification
