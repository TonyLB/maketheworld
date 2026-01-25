import React, { FunctionComponent, ReactNode } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'

export type WorkbenchSidebarTitledBoxProps = {
    title: string;
    sidebarTitle: string;
    minHeight: string;
    sidebar?: boolean;
    children: ReactNode;
}

/**
 * Workbench-specific SidebarTitledBox component that uses workbench theme colors.
 * 
 * This component uses the workbench theme's extras palette for sidebar styling,
 * providing orange/amber colors for sidebars like Exits and Lenses.
 * 
 * Used for sidebars in Room editing (Exits, Lenses).
 * 
 * Uses Material UI's `sx` prop theme-aware capabilities to access theme values directly.
 */
export const WorkbenchSidebarTitledBox: FunctionComponent<WorkbenchSidebarTitledBoxProps> = ({ 
    title, 
    sidebarTitle, 
    minHeight, 
    sidebar=true, 
    children 
}) => {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            marginTop: '1em',
            marginLeft: '0.5em',
            minHeight,
            border: (theme) => `2px solid ${(theme.palette as any).extras?.sidebarBorder ?? theme.palette.primary.main}`, 
            borderRadius: '0.5em',
            position: "relative"
        }}>
            {
                sidebar &&
                <Box sx={{
                    display: 'flex',
                    width: '2em',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: (theme) => (theme.palette as any).extras?.sidebarBackground ?? theme.palette.primary.light,
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
                        border: (theme) => `2px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`, 
                        borderRadius: '0.5em',
                        background: (theme) => (theme.palette as any).extras?.sectionHeaderBackground ?? theme.palette.primary.light,
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
}

export default WorkbenchSidebarTitledBox
