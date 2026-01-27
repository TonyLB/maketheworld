import React, { ReactNode, ReactElement, FunctionComponent } from 'react'
import { SxProps } from '@mui/system'
import { Theme } from '@mui/material'

import {
    Box
} from '@mui/material'

interface MessageComponentProps {
    leftIcon?: ReactElement;
    leftGutter?: Number;
    rightIcon?: ReactElement;
    rightGutter?: Number;
    toolActions?: ReactElement;
    sx?: SxProps<Theme>;
    children?: ReactNode;
    flush?: boolean; // When true, removes padding to allow background to extend to edges (for sticky headers)
}

export const MessageComponent: FunctionComponent<MessageComponentProps> = ({
    children,
    leftIcon,
    leftGutter = 70,
    rightIcon,
    rightGutter = 70,
    toolActions,
    sx,
    flush = false
}) => {
    return <Box sx={{ padding: flush ? 0 : "2px", position: "relative" }}>
            { toolActions
                ? <Box sx={{ position: "absolute", top: "0.25em", right: "0.5em" }}>
                    { toolActions }
                </Box>
                : null}
            <Box
                sx={{
                    ...sx,
                    display: "grid",
                    gridTemplateColumns: `${leftGutter}px 1fr ${rightGutter}px`,
                    gridTemplateAreas: "'leftIcon content rightIcon'",
                    gap: 0
                }}
            >
                <Box
                    sx={{
                        gridArea: "leftIcon",
                        alignItems: "stretch"
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%"
                        }}
                    >
                        { leftIcon || <React.Fragment>&nbsp;</React.Fragment> }
                    </Box>
                </Box>
                <Box
                    sx={{
                        gridArea: "content",
                        height: "100%"
                    }}
                >{children}</Box>
                <Box
                    sx={{
                        gridArea: "rightIcon",
                        alignItems: "stretch"
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%"
                        }}
                    >
                        { rightIcon || <React.Fragment>&nbsp;</React.Fragment> }
                    </Box>

                </Box>
            </Box>
        </Box>
}

export default MessageComponent