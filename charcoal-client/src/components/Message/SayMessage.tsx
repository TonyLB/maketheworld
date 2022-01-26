import React, { ReactChildren, ReactChild, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    Box,
    Typography,
    Avatar,
    Tooltip,
} from '@mui/material'
import {
    Theme
} from '@mui/material/styles'

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
    variant: 'left' | 'right';
    tailOffset?: string;
    children?: ReactChild | ReactChild[] | ReactChildren;
}

export const SpeechBubble: FunctionComponent<SpeechBubbleProps> = ({ variant, tailOffset = '16px', children }) => {
    return <Box
            sx={[{
                    background: (theme: any) => (theme.palette.extras.paleGradient),
                    padding: '10px 15px 15px 15px',
                    borderRadius: '15px',
                    position: 'relative',
                    marginRight: '10px',
                    marginLeft: '10px',
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        borderStyle: 'solid',
                        bottom: tailOffset,
                        borderTopColor: 'transparent',
                        borderBottomColor: 'transparent',
                        borderRightColor: 'extras.midPale',
                        borderLeftColor: 'extras.midPale'
                    },
                },
                variant === 'right' && {
                    '&::after': {
                        right: '-15px',
                        borderWidth: '10px 0 10px 15px',
                    }
                },
                variant === 'left' && {
                    '&::after': {
                        left: '-15px',
                        borderWidth: '10px 15px 10px 0',
                    }
                }
            ]}
        >
            {children}
        </Box>
}

export const SayMessage: FunctionComponent<SayMessageProps> = ({ message, variant }) => {
    const CharacterId = message.CharacterId
    const charactersInPlay = useSelector(getCharactersInPlay)
    const Name = charactersInPlay && charactersInPlay[CharacterId] && charactersInPlay[CharacterId].Name
    return <CharacterStyleWrapper CharacterId={CharacterId} nested>
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
            <SpeechBubble variant={variant}>
                <Box sx={{ fontWeight: 'bold' }}>
                    {message.Name}
                </Box>
                <Typography variant='body1' align='left'>
                    {message.Message}
                </Typography>
            </SpeechBubble>

        </MessageComponent>
    </CharacterStyleWrapper>
}

export default SayMessage