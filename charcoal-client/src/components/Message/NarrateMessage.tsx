import React, { ReactChildren, ReactChild, FunctionComponent } from 'react'

import {
    Box,
    Typography
} from '@mui/material'

import { CharacterColorWrapper } from '../CharacterStyleWrapper'
import { useActiveCharacter } from '../ActiveCharacter'

import { CharacterNarration } from '../../slices/messages/baseClasses'
import MessageComponent from './MessageComponent'
import CharacterAvatar from '../CharacterAvatar'

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
                    background: (theme: any) => (theme.palette.extras.paleGradient),
                    padding: '10px 15px 15px 15px',
                    position: 'relative',
                    marginRight: '10px',
                    marginLeft: '10px',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: tailOffset,
                        bgcolor: 'extras.midPale',
                        height: '16px',
                        width: '4px'
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: `calc(${tailOffset} + 4px)`,
                        bgcolor: 'extras.midPale',
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
    const { CharacterId: activeId } = useActiveCharacter()
    const { CharacterId, Color } = message
    return <CharacterColorWrapper color={CharacterId === activeId ? 'blue' : Color}>
        <MessageComponent
            leftIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'left' &&
                        <CharacterAvatar CharacterId={CharacterId} />
                    }
                </Box>
            }
            rightIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'right' &&
                        <CharacterAvatar CharacterId={CharacterId} />
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
    </CharacterColorWrapper>
}

export default NarrateMessage