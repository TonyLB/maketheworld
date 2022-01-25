/** @jsxImportSource @emotion/react */
import React, { ReactChildren, ReactChild, FunctionComponent } from 'react'
import { css } from '@emotion/react'
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
    variant: 'left' | 'right';
    children?: ReactChild | ReactChildren;
}

interface SpeechBubbleProps {
    Name?: string;
    Message: string;
    variant: 'left' | 'right';
}

const SpeechBubble: FunctionComponent<SpeechBubbleProps> = ({ variant, Name, Message }) => {
    return <Box
            sx={[{
                    bgcolor: 'extras.pale',
                    padding: '10px 15px 15px 15px',
                    borderRadius: '15px',
                    marginTop: '10px',
                    position: 'relative',
                    '&::before': {
                        content: `"${Name}"`,
                        fontWeight: 'bold',
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        borderStyle: 'solid',
                        bottom: '16px',
                        borderTopColor: 'transparent',
                        borderBottomColor: 'transparent',
                        borderRightColor: 'extras.pale',
                        borderLeftColor: 'extras.pale'
                    },
                },
                variant === 'right' && {
                    marginRight: '25px',
                    '&::after': {
                        right: '-25px',
                        borderWidth: '10px 0 10px 25px',
                    }
                },
                variant === 'left' && {
                    marginLeft: '25px',
                    '&::after': {
                        left: '-25px',
                        borderWidth: '10px 25px 10px 0',
                    }
                }
            ]}
        >
            <Typography variant='body1' align='left'>
                {Message}
            </Typography>
        </Box>
}

export const SayMessage: FunctionComponent<SayMessageProps> = ({ message, variant }) => {
    const CharacterId = message.CharacterId
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    return <CharacterStyleWrapper CharacterId={CharacterId}>
        <MessageComponent
            leftIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'left' && 
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                            { (Name || '?')[0].toUpperCase() }
                        </Avatar>
                    }
                </Box>
            }
            rightIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'right' && 
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                            { (Name || '?')[0].toUpperCase() }
                        </Avatar>
                    }
                </Box>
            }

        >
            <SpeechBubble Name={message.Name} Message={message.Message} variant={variant} />
        </MessageComponent>
    </CharacterStyleWrapper>
}

export default SayMessage