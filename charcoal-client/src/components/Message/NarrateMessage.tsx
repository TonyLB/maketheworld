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
    variant: 'left' | 'right';
    tailOffset?: string;
    children?: ReactChild | ReactChild[] | ReactChildren;
}

export const NarrateBubble: FunctionComponent<NarrateBubbleProps> = ({ variant, tailOffset="16px", children }) => {
    return <Box
            sx={[{
                    bgcolor: 'extras.pale',
                    // borderColor: 'primary.light',
                    // borderStyle: 'solid',
                    // borderWidth: '1px',
                    padding: '10px 15px 15px 15px',
                    position: 'relative',
                    marginRight: '10px',
                    marginLeft: '10px',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        // borderStyle: 'solid',
                        // borderColor: 'primary.light',
                        // borderWidth: '1px',
                        bottom: tailOffset,
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
                        bottom: `calc(${tailOffset} + 4px)`,
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
            { children }
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
            <NarrateBubble variant={variant}>
                <Typography variant='body1' align='left'>
                    {message.Message}
                </Typography>
            </NarrateBubble>
        </MessageComponent>
    </CharacterStyleWrapper>
}

export default NarrateMessage