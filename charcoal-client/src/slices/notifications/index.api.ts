import { EphemeraNotificationId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { socketDispatchPromise } from "../lifeLine"

export const markNotificationRead = (notificationId: EphemeraNotificationId) => async (dispatch: any) => {
    await dispatch(socketDispatchPromise({
        message: 'updateNotifications',
        updates: [{
            notificationId,
            read: true,
            archived: false
        }]
    }))
}
