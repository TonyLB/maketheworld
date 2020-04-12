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
import { getCharactersInPlay } from '../../selectors/charactersInPlay'
import useStyles from '../styles'

export const PlayerMessage = ({ message, ...rest }) => {
    const CharacterId = message.CharacterId
    const colorMap = useSelector(getColorMap)
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    const color = Name && colorMap && colorMap[Name]
    const classes = useStyles()
    return <ListItem className={ color && classes[color.light] } alignItems="flex-start" {...rest} >
        <ListItemAvatar>
            <Tooltip title={Name}>
                <Avatar className={color && classes[color.primary]}>
                    { Name[0].toUpperCase() }
                </Avatar>
            </Tooltip>
        </ListItemAvatar>
        <ListItemText>
            <Typography variant='body1' align='left'>
                { message.Message }
            </Typography>
        </ListItemText>
    </ListItem>
}

export default PlayerMessage