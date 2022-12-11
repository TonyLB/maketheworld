import { NotificationState } from './baseClasses'
import { Selector } from '../../store'
import { EphemeraNotificationId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { InformationNotification } from '@tonylb/mtw-interfaces/dist/messages'

export const getNotifications: Selector<NotificationState["notifications"]> = (state) => (state.notifications.notifications)
export const getNotification = (notificationId: EphemeraNotificationId | undefined): Selector<InformationNotification | undefined> => (state) => (notificationId ? state.notifications.notifications.find(({ NotificationId }) => (NotificationId === notificationId)) : undefined)
