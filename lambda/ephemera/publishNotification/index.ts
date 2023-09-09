import { v4 as uuidv4 } from 'uuid'
import { isInformationNotification, MessageBus, PublishNotification, PublishUpdateMarksNotification } from "../messageBus/baseClasses"
import internalCache from '../internalCache'
import { messageDeltaDB, messageDeltaUpdate } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { apiClient } from '../apiClient'
import { EphemeraNotificationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { InformationNotification, isUpdateMarksNotification, Notification } from '@tonylb/mtw-interfaces/ts/messages'

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

const publishNotificationDynamoDB = async (notification: Notification): Promise<InformationNotification | undefined> => {
    let returnValue: (InformationNotification & { CreatedTime: number }) | undefined
    if (isUpdateMarksNotification(notification)) {
        const { NotificationId, UpdateTime, Target, DisplayProtocol, ...rest } = notification
        const deltaUpdateValue = await messageDeltaUpdate<Omit<InformationNotification, 'NotificationId'> & { RowId: string; DeltaId: string }>({
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
        if (deltaUpdateValue) {
            const { RowId, DeltaId, ...deltaRest } = deltaUpdateValue
            returnValue = {
                ...deltaRest,
                NotificationId: RowId as EphemeraNotificationId
            }
        }
    }
    else {
        const { NotificationId, CreatedTime, Target, DisplayProtocol, ...rest } = notification
        returnValue = {
            Target,
            NotificationId,
            CreatedTime,
            DisplayProtocol,
            ...rest
        }
        await messageDeltaDB.putItem({
            ...returnValue,
            NotificationId: undefined,
            RowId: NotificationId,
            DeltaId: `${CreatedTime}::${NotificationId}`,
        })
    }
    return returnValue
}

export const publishNotification = async ({ payloads }: { payloads: PublishNotification[], messageBus?: MessageBus }): Promise<void> => {
    const CreatedTime = Date.now()

    let dbPromises: Promise<void>[] = []
    let notificationsByConnectionId: Record<string, InformationNotification[]> = {}

    const pushToQueues = async (notification: Notification): Promise<void> => {
        const connections = (await internalCache.PlayerConnections.get(notification.Target)) || []
        dbPromises.push(
            publishNotificationDynamoDB(notification)
                .then(async (translatedNotification) => {
                    if (translatedNotification) {
                        const connections = (await internalCache.PlayerConnections.get(translatedNotification.Target)) || []
                        connections.forEach((connectionId) => {
                            if (!(connectionId in notificationsByConnectionId)) {
                                notificationsByConnectionId[connectionId] = []
                            }
                            notificationsByConnectionId[connectionId].push(translatedNotification)
                        })
                    }
                })
        )
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

    await Promise.all(dbPromises)
    await Promise.all(
        Object.entries(notificationsByConnectionId)
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
}

export default publishNotification
