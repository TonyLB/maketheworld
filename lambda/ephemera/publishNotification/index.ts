import { v4 as uuidv4 } from 'uuid'
import { isCharacterMessage, isWorldMessage, PublishMessage, MessageBus, isRoomUpdatePublishMessage, isPublishTargetRoom, isPublishTargetCharacter, isPublishTargetExcludeCharacter, PublishTarget, isRoomDescriptionPublishMessage, isFeatureDescriptionPublishMessage, isCharacterDescriptionPublishMessage, PublishNotification, isInformationNotification, PublishUpdateMarksNotification } from "../messageBus/baseClasses"
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import internalCache from '../internalCache'
import { messageDB, messageDeltaDB, messageDeltaUpdate } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { RoomCharacterListItem } from '../internalCache/baseClasses'
import { apiClient } from '../apiClient'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { InformationNotification, isUpdateMarksNotification, Notification, UpdateMarksNotification } from '@tonylb/mtw-interfaces/dist/messages'

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

//
// TODO: Modify publishNotificationDynamoDB to use mergeDeltaUpdate on Update type notifications
//
const publishNotificationDynamoDB = async (notification: Notification): Promise<void> => {
    if (isUpdateMarksNotification(notification)) {
        const { NotificationId, UpdateTime, Target, DisplayProtocol, ...rest } = notification
        await messageDeltaUpdate({
            Target,
            RowId: NotificationId,
            UpdateTime,
            transform: (previous: Omit<InformationNotification, 'NotificationId'> & { RowId: string; DeltaId: string; }) => {
                return {
                    ...previous,
                    read: rest.read,
                    archived: rest.archived,
                    DeltaId: `${UpdateTime}::${NotificationId}`
                }
            }
        })
    }
    else {
        const { NotificationId, CreatedTime, Target, DisplayProtocol, ...rest } = notification
        await messageDeltaDB.putItem({
            Target,
            DeltaId: `${CreatedTime}::${NotificationId}`,
            RowId: NotificationId,
            CreatedTime,
            ...rest
        })
    }
}

export const publishNotification = async ({ payloads }: { payloads: PublishNotification[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()

    let dbPromises: Promise<void>[] = []
    let notificationsByConnectionId: Record<string, (Notification & { CreatedTime: number; NotificationId: string; })[]> = {}

    const pushToQueues = async <T extends Notification & { CreatedTime: number; NotificationId: string; }>(notification: T): Promise<void> => {
        const connections = (await internalCache.PlayerConnections.get(notification.Target)) || []
        dbPromises.push(publishNotificationDynamoDB(notification))
        connections.forEach((connectionId) => {
            if (!(connectionId in notificationsByConnectionId)) {
                notificationsByConnectionId[connectionId] = []
            }
            notificationsByConnectionId[connectionId].push(notification)
        })
    }

    await Promise.all(payloads.map(async (payload, index) => {
        if (isInformationNotification(payload)) {
            await pushToQueues({
                Target: payload.target,
                Subject: payload.subject,
                NotificationId: `NOTIFICATION#${uuidv4()}`,
                CreatedTime: CreatedTime + index,
                Message: payload.message,
                DisplayProtocol: payload.displayProtocol,
            })
        }
        if (((value: PublishNotification): value is PublishUpdateMarksNotification => (value.displayProtocol === 'UpdateMarks'))(payload)) {
            await pushToQueues({
                Target: payload.target,
                NotificationId: payload.notificationId,
                UpdateTime: CreatedTime + index,
                read: payload.read,
                archived: payload.archived,
                DisplayProtocol: payload.displayProtocol
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
