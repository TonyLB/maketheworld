import React, { ReactChildren, ReactChild } from 'react'
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
import useStyles, { playerStyle } from '../styles'

import { CharacterText } from '../../slices/messages/baseClasses'

interface PlayerMessageProps {
    message: CharacterText;
    children?: ReactChild | ReactChildren;
}

export const PlayerMessage = ({ message, ...rest }: PlayerMessageProps) => {
    const CharacterId = message.CharacterId
    const { CharacterId: myCharacterId } = useActiveCharacter()
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    const color = (CharacterId === myCharacterId) ? { name: 'blue', primary: 'blue', light: 'lightblue' } : (charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].color) || ''
    const classes = useStyles()
    return <div className={ color && classes[playerStyle(color.name) as keyof typeof classes] }> 
            <ListItem className='messageColor' alignItems="flex-start" {...rest} >
            <ListItemAvatar>
                <Tooltip title={Name || '?'}>
                    <Avatar className='avatarColor'>
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
    </div>
}

export default PlayerMessage