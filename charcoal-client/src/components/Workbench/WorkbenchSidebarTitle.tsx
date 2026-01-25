import React, { FunctionComponent, ReactNode } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'

/**
 * Workbench-specific SidebarTitle component that uses workbench theme colors.
 * 
 * This component displays a vertical sidebar with rotated title text,
 * used for "Exits" and "Lens" sidebars in Room editing.
 * 
 * Uses Material UI's `sx` prop theme-aware capabilities to access theme values directly.
 */
export const WorkbenchSidebarTitle: FunctionComponent<{ 
    title: string, 
    minHeight: string, 
    children: ReactNode 
}> = ({ title, minHeight, children }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '0.5em',
        marginLeft: '0.5em'
    }}>
        <Box sx={{
            display: 'flex',
            width: '2em',
            minHeight,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: (theme) => (theme.palette as any).extras?.sidebarBackground ?? theme.palette.primary.light,
            borderTopColor: (theme) => (theme.palette as any).extras?.sidebarBorder ?? theme.palette.primary.main,
            borderTopStyle: 'solid',
            borderBottomColor: (theme) => (theme.palette as any).extras?.sidebarBorder ?? theme.palette.primary.main,
            borderBottomStyle: 'solid',
            marginRight: '0.5em'
        }}>
            <Typography
                sx={{ transform: 'rotate(-90deg)' }}
                variant="h5"
            >
                { title }
            </Typography>
        </Box>
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
        }}>
            { children }
        </Box>
    </Box>
)

export default WorkbenchSidebarTitle
