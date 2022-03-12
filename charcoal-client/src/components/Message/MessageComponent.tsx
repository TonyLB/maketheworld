/** @jsxImportSource @emotion/react */
import React, { ReactChildren, ReactChild, ReactElement, FunctionComponent } from 'react'
import { css } from '@emotion/react'
import { SxProps } from '@mui/system'
import { Theme } from '@mui/material'

import {
    Box,
    Grid
} from '@mui/material'

interface MessageComponentProps {
    leftIcon?: ReactElement;
    leftGutter?: Number;
    rightIcon?: ReactElement;
    rightGutter?: Number;
    sx?: SxProps<Theme>;
    children?: ReactChild | ReactChildren;
}

export const MessageComponent: FunctionComponent<MessageComponentProps> = ({
    children,
    leftIcon,
    leftGutter = 70,
    rightIcon,
    rightGutter = 70,
    sx
}) => {
    return <Box sx={{ padding: "2px" }}>
            <Box
                sx={sx}
                css={css`
                    display: grid;
                    grid-template-areas:
                        "leftIcon content rightIcon";
                    grid-template-columns: ${`${leftGutter}`}px 1fr ${`${rightGutter}`}px;
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
                        height: 100%;
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
                    align-items: stretch;
                `}>
                    <Box css={css`
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                    `}>
                        { rightIcon || <React.Fragment>&nbsp;</React.Fragment> }
                    </Box>

                </Box>
            </Box>
        </Box>
}

export default MessageComponent