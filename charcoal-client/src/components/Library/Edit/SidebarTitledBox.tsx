import React, { FunctionComponent, ReactNode } from "react"

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { blue } from "@mui/material/colors"

export type SidebardTitledBoxProps = {
    title: string;
    sidebarTitle: string;
    minHeight: string;
    sidebar?: boolean;
    children: ReactNode;
}

export const SidebarTitledBox: FunctionComponent<SidebardTitledBoxProps> = ({ title, sidebarTitle, minHeight, sidebar=true, children }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '1em',
        marginLeft: '0.5em',
        minHeight,
        border: `2px solid ${blue[500]}`, borderRadius: '0.5em',
        position: "relative"
    }}>
        {
            sidebar &&
            <Box sx={{
                display: 'flex',
                width: '2em',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: blue[50],
                marginRight: '0.5em',
                borderRadius: "0.5em 0 0 0.5em"
            }}>
                <Typography
                    sx={{ transform: 'rotate(-90deg)' }}
                    variant="h5"
                >
                    { sidebarTitle }
                </Typography>
            </Box>
        }
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            paddingTop: "1em"
        }}>
            <Box
                sx={{
                    position: "absolute",
                    top: "-1em",
                    left: sidebar ? "2.5em" : "0.25em",
                    border: `2px solid ${blue[500]}`, borderRadius: '0.5em',
                    background: blue[100],
                    paddingLeft: "0.5em",
                    paddingRight: "0.5em"
                }}
            >
                {title}
            </Box>
            { children }
        </Box>
    </Box>
)

export default SidebarTitledBox
