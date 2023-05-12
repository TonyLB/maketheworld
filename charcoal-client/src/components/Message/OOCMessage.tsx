import React, { ReactChildren, ReactChild, FunctionComponent } from 'react'

import {
    Box,
    Typography
} from '@mui/material'

import { CharacterColorWrapper } from '../CharacterStyleWrapper'
import { useActiveCharacter } from '../ActiveCharacter'
import TaggedMessageContent from './TaggedMessageContent'

import { OutOfCharacterMessage } from '@tonylb/mtw-interfaces/dist/messages'
import MessageComponent from './MessageComponent'
import CharacterAvatar from '../CharacterAvatar'

interface OOCMessageProps {
    message: OutOfCharacterMessage;
    variant: 'left' | 'right';
    children?: ReactChild | ReactChildren;
}

interface OOCBubbleProps {
    variant: 'left' | 'right';
    tailOffset?: string;
    children?: ReactChild | ReactChild[] | ReactChildren;
}

export const OOCBubble: FunctionComponent<OOCBubbleProps> = ({ variant, tailOffset = '16px', children }) => {
    return <Box
            sx={[{
                    background: (theme: any) => (theme.palette.extras.stripedGradient),
                    backgroundBlendMode: 'multiply',
                    padding: '10px 15px 15px 15px',
                    borderRadius: '15px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: 'extras.midPale',
                    position: 'relative',
                    marginRight: '10px',
                    marginLeft: '10px',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        borderStyle: 'solid',
                        bottom: tailOffset,
                        borderWidth: '1px',
                        borderTopColor: 'transparent',
                        borderBottomColor: 'transparent',
                        borderRightColor: 'extras.midPale',
                        borderLeftColor: 'extras.midPale'
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        borderStyle: 'solid',
                        bottom: tailOffset,
                        borderWidth: '1px',
                        borderTopColor: 'transparent',
                        borderBottomColor: 'transparent',
                        borderRightColor: 'white',
                        borderLeftColor: 'white'
                    },
                },
                variant === 'right' && {
                    '&::before': {
                        right: '-15px',
                        borderWidth: '10px 0 10px 15px',
                    },
                    '&::after': {
                        right: '-13px',
                        borderWidth: '10px 0 10px 15px',
                    }
                },
                variant === 'left' && {
                    '&::before': {
                        left: '-15px',
                        borderWidth: '10px 15px 10px 0',
                    },
                    '&::after': {
                        left: '-13px',
                        borderWidth: '10px 15px 10px 0',
                    }
                }
            ]}
        >
            {children}
        </Box>
}

export const OOCMessage: FunctionComponent<OOCMessageProps> = ({ message, variant }) => {
    const { CharacterId: activeId } = useActiveCharacter()
    const { CharacterId, Color } = message
    return <CharacterColorWrapper color={CharacterId === activeId ? 'blue' : Color}>
        <MessageComponent
            leftIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'left' &&
                        <CharacterAvatar CharacterId={CharacterId} fileURL={message.fileURL} />
                    }
                </Box>
            }
            rightIcon={
                <Box sx={{ height: "100%", display: 'flex', alignItems: 'end', paddingBottom: '5px' }}>
                    { variant === 'right' &&
                        <CharacterAvatar CharacterId={CharacterId} fileURL={message.fileURL} />
                    }
                </Box>
            }
        >
            <OOCBubble variant={variant}>
                <Box sx={{ fontWeight: 'bold' }}>
                    {message.Name} (out of character)
                </Box>
                <Typography variant='body1' align='left'>
                    <TaggedMessageContent list={message.Message} onClickLink={() => {}} />
                </Typography>
            </OOCBubble>

        </MessageComponent>
    </CharacterColorWrapper>
}

export default OOCMessage