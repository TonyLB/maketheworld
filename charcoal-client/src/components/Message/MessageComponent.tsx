/** @jsxImportSource @emotion/react */
import React, { ReactChildren, ReactChild, ReactElement } from 'react'
import { css } from '@emotion/react'
import { SxProps } from '@mui/system'
import { Theme } from '@mui/material'

import {
    Box,
    Grid
} from '@mui/material'

interface MessageComponentProps {
    leftIcon?: ReactElement;
    rightIcon?: ReactElement;
    sx?: SxProps<Theme>;
    children?: ReactChild | ReactChildren;
}

export const MessageComponent = ({ children, leftIcon, rightIcon, sx }: MessageComponentProps) => {
    return <Box sx={{ padding: "2px" }}>
            <Box
                sx={sx}
                css={css`
                    display: grid;
                    grid-template-areas:
                        "leftIcon content rightIcon";
                    grid-template-columns: 70px 1fr 70px;
                `}
            >
                <Box css={css`
                    grid-area: leftIcon;
                    align-items: stretch;
                `}>
                    <Box css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `}>
                        { leftIcon || <React.Fragment>&nbsp;</React.Fragment> }
                    </Box>
                </Box>
                <Box css={css`
                    grid-area: content;
                    height: 100%;
                `}>{children}</Box>
                <Box css={css`
                    grid-area: rightIcon;
                `}>{ rightIcon || <React.Fragment>&nbsp;</React.Fragment> }</Box>
            </Box>
        </Box>
}

export default MessageComponent