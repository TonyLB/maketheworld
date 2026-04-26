import React, { ReactNode } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import RenderTreeContent from './RenderTreeContent'
import type { WorldOOCMessage as WorldOOCMessageType } from '@tonylb/mtw-interfaces/ts/messages'

interface WorldOOCMessageProps {
    message: WorldOOCMessageType;
    children?: ReactNode;
}

export const WorldOOCMessage = ({ message, ...rest }: WorldOOCMessageProps) => {
    return <MessageComponent
            sx={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '25px', paddingLeft: '25px' }}
            {...rest}
        >
            <Box
                sx={{
                    background: (theme: any) => (theme.palette.extras?.stripedGradientGrey ?? grey[100]),
                    backgroundBlendMode: 'multiply',
                    padding: '10px 15px 15px 15px',
                    borderRadius: '15px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: grey[300],
                }}
            >
                <Box sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                    Out of character
                </Box>
                <Typography variant='body1' align='left'>
                    <RenderTreeContent list={message.Message} onClickLink={() => {}} />
                </Typography>
            </Box>
        </MessageComponent>
}

export default WorldOOCMessage
