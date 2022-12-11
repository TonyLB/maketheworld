import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import cacheDB, { LastSyncType } from '../../cacheDB'
import { InformationNotification } from '@tonylb/mtw-interfaces/dist/messages'

const initialState = { notifications: [] as InformationNotification[] }

//
// To efficiently insert Messages into the sorted state array, it helps to take advantage of its
// sorted nature in deducing the correct insert location
//
export const binarySearch = (arr: InformationNotification[], createdTime: number, notificationId: string): { exactMatch: boolean; index: number } => {
    let bottom = 0
    let top = arr.length - 1
    while (top >= bottom) {
        const mid = (top + bottom) >>> 1
        const search = arr[mid].CreatedTime
        if (search === createdTime) {
            const searchNotificationId = arr[mid].NotificationId
            if (searchNotificationId === notificationId) {
                return { exactMatch: true, index: mid }
            }
            if (searchNotificationId.localeCompare(notificationId) === 1) {
                top = mid - 1
            }
            else {
                bottom = mid + 1
            }
        }
        else {
            if (search > createdTime) {
                top = mid - 1
            }
            else {
                bottom = mid + 1
            }
        }
    }
    return { exactMatch: false, index: bottom }
}

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        receiveNotifications(state: any, action: PayloadAction<InformationNotification[]>) {
            action.payload.forEach((notification) => {
                if (state.notifications) {
                    const { exactMatch, index } = binarySearch(state.notifications, notification.CreatedTime, notification.NotificationId)
                    if (exactMatch) {
                        state.notifications[index] = notification
                    }
                    else {
                        if (index >= state.notifications.length) {
                            state.notifications.push(notification)
                        }
                        else {
                            state.notifications.splice(index, 0, notification)
                        }
                    }    
                }
                else {
                    state.notifications = [notification]
                }
            })
        }
    }
})

export const { receiveNotifications } = notificationsSlice.actions

export const cacheNotifications = (notifications: InformationNotification[]) => async (dispatch: any) => {
    //
    // Update LastSync data, and push messages to cacheDB
    //
    // const lastSyncUpdates = notifications.reduce((previous, { CreatedTime, Target }) => ({
    //     ...previous,
    //     [Target]: Math.max(previous[Target] || 0, CreatedTime)
    // }), {} as LastSyncType["value"])
    // await Promise.all([
    //     cacheDB.clientSettings.update("LastSync", (lastSync: LastSyncType) => (
    //         Object.entries(lastSyncUpdates).reduce((previous, [Target, CreatedTime]) => ({
    //             ...previous,
    //             [Target]: Math.max(previous[Target] || 0, CreatedTime)
    //         }), lastSync.value)
    //     )).then((update) => {
    //         if (!update) {
    //             cacheDB.clientSettings.put({ key: "LastSync", value: lastSyncUpdates })
    //         }
    //     }),
    //     cacheDB.messages.bulkPut(notifications)
    // ])

    //
    // Push notifications to Redux
    //
    dispatch(receiveNotifications(notifications))
}

export {
    getNotifications
} from './selectors'

export default notificationsSlice.reducer
