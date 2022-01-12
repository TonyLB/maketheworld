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

import { getCharactersInPlay } from '../../slices/ephemera'
import { useActiveCharacter } from '../ActiveCharacter'
import useStyles from '../styles'

export const PlayerMessage = React.forwardRef(({ message, ...rest }, ref) => {
    const CharacterId = message.CharacterId
    const { CharacterId: myCharacterId } = useActiveCharacter()
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    const color = (CharacterId === myCharacterId) ? { primary: 'blue', light: 'lightblue' } : (charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].color) || ''
    const classes = useStyles()
    return <ListItem ref={ref} className={ color && classes[color.light] } alignItems="flex-start" {...rest} >
        <ListItemAvatar>
            <Tooltip title={Name || '?'}>
                <Avatar className={color && classes[color.primary]}>
                    { (Name || '?')[0].toUpperCase() }
                </Avatar>
            </Tooltip>
        </ListItemAvatar>
        <ListItemText>
            <Typography variant='body1' align='left'>
                { message.Message }
            </Typography>
        </ListItemText>
    </ListItem>
})

export default PlayerMessage