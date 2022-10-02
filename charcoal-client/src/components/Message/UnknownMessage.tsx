import React, { ReactChild, ReactChildren } from 'react'

import {
    Box,
    Typography,
} from '@mui/material'

import MessageComponent from './MessageComponent'
import { Message } from '@tonylb/mtw-interfaces/dist/messages'

interface UnknownMessageProps {
    message: Message;
    children?: ReactChild | ReactChildren;
}


export const UnknownMessage = ({ message, ...rest }: UnknownMessageProps) => {
    return <MessageComponent
            sx={{ paddingTop: "15px", paddingBottom: "15px" }}
        >
            <Box sx={{ height: "100%" }}>
                <Typography variant='body1' align='left'>
                    Unknown message type: { JSON.stringify(message, null, 4) }
                </Typography>
            </Box>
        </MessageComponent>
}

export default UnknownMessage