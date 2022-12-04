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

import AssetIcon from '@mui/icons-material/Landscape'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'

interface NotificationsProps {

}

export const Notifications: FunctionComponent<NotificationsProps> = () => {
    const dispatch = useDispatch()
    useAutoPin({ href: `/Library/`, label: `Library`})
    const navigate = useNavigate()

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Notifications</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={3}
        >
            <Grid item xs={6}>
            </Grid>
            <Grid item xs={6}>
            </Grid>
        </Grid>
    </Box>
}

export default Notifications
