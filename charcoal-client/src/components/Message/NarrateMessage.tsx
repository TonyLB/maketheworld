import React, { ReactChildren, ReactChild, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    Box,
    Typography,
    Avatar,
    Tooltip
} from '@mui/material'

import { getCharactersInPlay } from '../../slices/ephemera'
import CharacterStyleWrapper from '../CharacterStyleWrapper'

import { CharacterNarration } from '../../slices/messages/baseClasses'
import MessageComponent from './MessageComponent'

interface NarrateMessageProps {
    message: CharacterNarration;
    variant: 'left' | 'right';
    children?: ReactChild | ReactChildren;
}

interface NarrateBubbleProps {
    Message: string;
    variant: 'left' | 'right';
}

const NarrateBubble: FunctionComponent<NarrateBubbleProps> = ({ variant, Message }) => {
    return <Box
            sx={[{
                    bgcolor: 'extras.pale',
                    // borderColor: 'primary.light',
                    // borderStyle: 'solid',
                    // borderWidth: '1px',
                    padding: '15px',
                    position: 'relative',
                    marginRight: '10px',
                    marginLeft: '10px',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        // borderStyle: 'solid',
                        // borderColor: 'primary.light',
                        // borderWidth: '1px',
                        bottom: '16px',
                        bgcolor: 'extras.pale',
                        height: '16px',
                        width: '4px'
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        // borderStyle: 'solid',
                        // borderColor: 'primary.light',
                        // borderWidth: '1px',
                        bottom: '20px',
                        bgcolor: 'extras.pale',
                        height: '8px',
                        width: '4px'
                    },
                },
                variant === 'right' && {
                    '&::before': {
                        right: '-10px',
                    },
                    '&::after': {
                        right: '-17px',
                    }
                },
                variant === 'left' && {
                    '&::before': {
                        left: '-10px',
                    },
                    '&::after': {
                        left: '-17px',
                    }
                }
            ]}
        >
            <Typography variant='body1' align='left'>
                {Message}
            </Typography>
        </Box>
}
export const NarrateMessage = ({ message, variant }: NarrateMessageProps) => {
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
            <NarrateBubble Message={message.Message} variant={variant} />
        </MessageComponent>
    </CharacterStyleWrapper>
}

export default NarrateMessage