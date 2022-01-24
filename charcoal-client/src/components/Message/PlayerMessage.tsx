import React, { ReactChildren, ReactChild } from 'react'
import { useSelector } from 'react-redux'

import {
    Typography,
    Avatar,
    Tooltip,
    ListItem,
    ListItemText,
    ListItemAvatar
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

import { CharacterNarration, CharacterSpeech } from '../../slices/messages/baseClasses'


interface PlayerMessageProps {
    message: CharacterNarration | CharacterSpeech;
    children?: ReactChild | ReactChildren;
}

export const PlayerMessage = ({ message, ...rest }: PlayerMessageProps) => {
    const CharacterId = message.CharacterId
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    return <CharacterStyleWrapper CharacterId={CharacterId}>
        <ListItem sx={{ color: 'black', bgcolor: 'extras.pale' }} alignItems="flex-start" {...rest} >
            <ListItemAvatar>
                <Tooltip title={Name || '?'}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                        { (Name || '?')[0].toUpperCase() }
                    </Avatar>
                </Tooltip>
            </ListItemAvatar>
            <ListItemText>
                <Typography variant='body1' align='left'>
                    { message.DisplayProtocol === 'SayMessage'
                        ? `${message.Name} says "${message.Message}"`
                        : message.Message
                    }
                </Typography>
            </ListItemText>
        </ListItem>
    </CharacterStyleWrapper>
}

export default PlayerMessage