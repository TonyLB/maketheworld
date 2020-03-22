import React from 'react'
import { useSelector } from 'react-redux'

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar
} from '@material-ui/core'

import { getColorMap } from '../../selectors/colorMap.js'
import useStyles from '../styles'

export const PlayerMessage = ({ message, ...rest }) => {
    const name = message.name
    const colorMap = useSelector(getColorMap)
    const color = name && colorMap && colorMap[name]
    const classes = useStyles()
    return <ListItem className={ color && classes[color.light] } alignItems="flex-start" {...rest} >
        <ListItemAvatar>
            <Tooltip title={name}>
                <Avatar className={color && classes[color.primary]}>
                    { name[0].toUpperCase() }
                </Avatar>
            </Tooltip>
        </ListItemAvatar>
        <ListItemText>
            <Typography variant='body1' align='left'>
                { message.message }
            </Typography>
        </ListItemText>
    </ListItem>
}

export default PlayerMessage