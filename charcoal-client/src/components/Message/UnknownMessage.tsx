import React, { ReactChild, ReactChildren } from 'react'

import {
    Typography,
    ListItem,
    ListItemText
} from '@mui/material'

import { Message } from '../../slices/messages/baseClasses'

interface UnknownMessageProps {
    message: Message;
    children?: ReactChild | ReactChildren;
}


export const UnknownMessage = ({ message, ...rest }: UnknownMessageProps) => {
    return <ListItem alignItems="flex-start" {...rest} >
        <ListItemText inset>
            <Typography variant='body1' align='left'>
                Unknown message type: { JSON.stringify(message, null, 4) }
            </Typography>
        </ListItemText>
    </ListItem>
}

export default UnknownMessage