import React, { ReactChildren, ReactChild } from 'react'
import { useSelector } from 'react-redux'

import {
    Box,
    Typography,
    Avatar,
    Tooltip
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

import { CharacterSpeech } from '../../slices/messages/baseClasses'
import MessageComponent from './MessageComponent'

interface SayMessageProps {
    message: CharacterSpeech;
    // variant: 'left' | 'right';
    children?: ReactChild | ReactChildren;
}

export const SayMessage = ({ message }: SayMessageProps) => {
    const CharacterId = message.CharacterId
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    return <CharacterStyleWrapper CharacterId={CharacterId}>
        <MessageComponent
            sx={{ bgcolor: "extras.pale", paddingTop: "15px", paddingBottom: "15px" }}
            leftIcon={
                <Tooltip sx={{ alignText: "center", bgcolor: "extras.pale" }} title={Name || '?'}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                        { (Name || '?')[0].toUpperCase() }
                    </Avatar>
                </Tooltip>
            }
        >
            <Box sx={{ height: "100%" }}>
                <Typography variant='body1' align='left'>
                    {message.Name} says "{message.Message}"
                </Typography>
            </Box>
        </MessageComponent>
    </CharacterStyleWrapper>
}

export default SayMessage