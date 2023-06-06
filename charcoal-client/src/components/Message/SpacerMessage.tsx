import React, { FunctionComponent } from 'react'

import {
    Box
} from '@mui/material'

import { SpacerMessage as SpacerMessageType } from '@tonylb/mtw-interfaces/dist/messages'

interface SpacerMessageProps {
    message: SpacerMessageType;
}

//
// TODO: Figure out why a smaller SpacerMessage (e.g. 1px height) interacts so badly with
// AlwaysShowOnboarding when the message panel's last message displayed is a room header
//
export const SpacerMessage: FunctionComponent<SpacerMessageProps> = () => {
    return <Box sx={{ width: "100%", height: "10px" }}>&nbsp;</Box>
}

export default SpacerMessage
