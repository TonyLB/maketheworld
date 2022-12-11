import { FunctionComponent, useState } from 'react'

import {
    Box,
    Divider,
    Grid,
} from '@mui/material'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { NotificationList } from './NotificationList'
import { EphemeraNotificationId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { NotificationDetail } from './NotificationDetail'

interface NotificationsProps {

}

export const Notifications: FunctionComponent<NotificationsProps> = () => {
    useAutoPin({ href: `/Notifications/`, label: `Notify`, iconName: 'Notifications' })
    const [selectedNotificationId, setSelectedNotificationId] = useState<EphemeraNotificationId | undefined>()

    return <Box sx={{ flexGrow: 1, padding: "10px", height: "100%", display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Notifications</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px", flexGrow: 1 }}
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={3}
        >
            <Grid item xs={6} sx={{ height: "100%" }}>
                <NotificationList selected={selectedNotificationId} setSelected={setSelectedNotificationId} />
            </Grid>
            <Grid item xs={6} sx={{ height: "100%" }}>
                { selectedNotificationId && <NotificationDetail NotificationId={selectedNotificationId} /> }
            </Grid>
        </Grid>
    </Box>
}

export default Notifications
