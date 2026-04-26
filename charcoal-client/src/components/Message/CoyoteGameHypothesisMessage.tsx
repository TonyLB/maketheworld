import React, { ReactNode } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import type { CoyoteGameHypothesisMessage as CoyoteGameHypothesisMessageType } from '@tonylb/mtw-interfaces/ts/messages'
import RenderTreeContent from './RenderTreeContent'

interface CoyoteGameHypothesisMessageProps {
    message: CoyoteGameHypothesisMessageType;
    children?: ReactNode;
}

export const CoyoteGameHypothesisMessage = ({ message, ...rest }: CoyoteGameHypothesisMessageProps) => {
    return <MessageComponent
            sx={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '25px', paddingLeft: '25px' }}
            {...rest}
        >
            <Box
                data-testid="coyote-game-hypothesis-message"
                sx={{
                    background: `linear-gradient(160deg, ${grey[700]} 0%, ${grey[600]} 100%)`,
                    borderRadius: '14px',
                    padding: '12px 16px'
                }}
            >
                <Typography variant='body1' align='left' sx={{ color: grey[100] }}>
                    <RenderTreeContent list={message.Message} onClickLink={() => {}} />
                </Typography>
            </Box>
        </MessageComponent>
}

export default CoyoteGameHypothesisMessage
