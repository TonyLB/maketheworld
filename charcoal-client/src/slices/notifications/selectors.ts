import { NotificationState } from './baseClasses'
import { Selector } from '../../store'

export const getNotifications: Selector<NotificationState["notifications"]> = (state) => (state.notifications.notifications)
