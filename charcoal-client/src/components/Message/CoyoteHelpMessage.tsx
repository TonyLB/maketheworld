import React, { ReactNode } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { grey } from '@mui/material/colors'

import MessageComponent from './MessageComponent'
import type { CoyoteGameHelpMessage as CoyoteGameHelpMessageType } from '@tonylb/mtw-interfaces/ts/messages'

interface CoyoteHelpMessageProps {
    message: CoyoteGameHelpMessageType;
    children?: ReactNode;
}

export const CoyoteHelpMessage = ({ message: _message, ...rest }: CoyoteHelpMessageProps) => {
    return <MessageComponent
            sx={{ paddingTop: '10px', paddingBottom: '10px', paddingRight: '25px', paddingLeft: '25px' }}
            {...rest}
        >
            <Box
                sx={{
                    background: (theme: any) => (theme.palette.extras?.stripedGradientCoyoteHelp ?? grey[100]),
                    backgroundBlendMode: 'multiply',
                    padding: '12px 16px 16px 16px',
                    borderRadius: '15px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                    borderColor: grey[400],
                    boxShadow: `inset 0 0 0 1px ${grey[200]}`,
                }}
            >
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold', color: 'text.secondary', marginBottom: '0.25em' }}>
                    Welcome to the Coyote Game
                </Typography>
                <Typography variant='body1' align='left' sx={{ marginBottom: '0.75em' }}>
                    You play a supra-genius coyote in the cartoon American Southwest. You are very intelligent and very hungry. There is a road runner. It is very fast, very stupid, and (you surmise) very delicious.
                </Typography>
                <Typography variant='body2' align='left' sx={{ marginBottom: '0.5em' }}>
                    Move around by giving a direction or destination: "east" or "climb up the cliff."
                </Typography>
                <Typography variant='body2' align='left' sx={{ marginBottom: '0.5em' }}>
                    Order Acme products by describing what you want to buy from the catalog: "order rocket power roller-skates" or "order a plate of birdseed and a cannister of ball bearings from Acme."
                </Typography>
                <Typography variant='body2' align='left'>
                    Wait for the Road Runner to put your plan into action: "wait for road runner."
                </Typography>
            </Box>
        </MessageComponent>
}

export default CoyoteHelpMessage
