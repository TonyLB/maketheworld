import React, { FunctionComponent, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import {
    Avatar,
    Box,
    Divider,
    Grid,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader
} from '@mui/material'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { NotificationList } from './NotificationList'

interface NotificationsProps {

}

export const Notifications: FunctionComponent<NotificationsProps> = () => {
    const dispatch = useDispatch()
    useAutoPin({ href: `/Notifications/`, label: `Notify`, iconName: 'Notifications' })
    const navigate = useNavigate()

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
                <NotificationList />
            </Grid>
            <Grid item xs={6} sx={{ height: "100%" }}>
            </Grid>
        </Grid>
    </Box>
}

export default Notifications
