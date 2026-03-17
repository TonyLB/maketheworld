import React, { ReactChild, ReactChildren, ReactFragment, ReactNode } from 'react'

import {
    Box,
    Typography,
    ListItem,
    ListItemText
} from '@mui/material'

import MessageComponent from './MessageComponent'
import { WorldMessage as WorldMessageType } from '@tonylb/mtw-interfaces/ts/messages'
import RenderTreeContent from './RenderTreeContent'

interface WorldMessageProps {
    message: WorldMessageType;
    children?: ReactNode;
}

export const WorldMessage = ({ message, ...rest }: WorldMessageProps) => {
    //
    // TODO: Replace render here with the general utility function abstracted from RoomDescription
    // component
    //

    return <MessageComponent
            sx={{ paddingTop: "10px", paddingBottom: "10px", paddingRight: "25px", paddingLeft: "25px" }}
        >
            <Box sx={{ height: "100%" }}>
                <Typography variant='body1' align='left'>
                    <RenderTreeContent list={message.Message} onClickLink={() => {}} />
                </Typography>
            </Box>
        </MessageComponent>
}

export default WorldMessage