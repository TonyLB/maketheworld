import React, { FunctionComponent } from 'react'

import {
    Box
} from '@mui/material'

import { SpacerMessage as SpacerMessageType } from '@tonylb/mtw-interfaces/dist/messages'

interface SpacerMessageProps {
    message: SpacerMessageType;
}


export const SpacerMessage: FunctionComponent<SpacerMessageProps> = () => {
    return <Box sx={{ width: "100%", height: "1px" }} />
}

export default SpacerMessage
