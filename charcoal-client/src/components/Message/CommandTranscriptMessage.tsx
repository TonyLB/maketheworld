import React, { ReactNode } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { grey } from '@mui/material/colors'
import ErrorIcon from '@mui/icons-material/Error'

import MessageComponent from './MessageComponent'
import RenderTreeContent from './RenderTreeContent'
import type { CommandTranscriptMessage as CommandTranscriptMessageType } from '@tonylb/mtw-interfaces/ts/messages'

interface CommandTranscriptMessageProps {
    message: CommandTranscriptMessageType;
    children?: ReactNode;
}

export const CommandTranscriptMessage = ({ message, ...rest }: CommandTranscriptMessageProps) => {
    return <MessageComponent
            sx={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '25px', paddingLeft: '25px' }}
            {...rest}
        >
            <Box
                data-testid="command-transcript-message"
                sx={{
                    backgroundColor: grey[100],
                    padding: '6px 10px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: grey[400],
                }}
            >
                <Typography variant='body2' align='left' sx={{ fontFamily: 'monospace', margin: 0 }}>
                    <RenderTreeContent list={message.Message} onClickLink={() => {}} />
                </Typography>
                {message.Outcome && <Box
                    data-testid="command-transcript-outcome"
                    data-kind={message.Outcome.Kind}
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '4px 0 0 0' }}
                >
                    {message.Outcome.Kind === 'Error' && <ErrorIcon
                        data-testid="command-transcript-outcome-icon"
                        titleAccess="Error"
                        fontSize='small'
                        sx={{ color: 'error.main', flexShrink: 0 }}
                    />}
                    <Typography
                        variant='body2'
                        align='left'
                        sx={{ margin: 0, color: message.Outcome.Kind === 'Error' ? 'text.primary' : 'text.secondary' }}
                    >
                        <RenderTreeContent list={message.Outcome.Message} onClickLink={() => {}} />
                    </Typography>
                </Box>}
            </Box>
        </MessageComponent>
}

export default CommandTranscriptMessage
