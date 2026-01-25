import Box from "@mui/material/Box"
import React, { FunctionComponent, ReactNode } from "react"

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../theme/extensions'

type WorkbenchTitledBoxProperties = {
    title?: string;
    children?: ReactNode;
}

/**
 * Workbench-specific TitledBox component that uses workbench theme colors.
 * 
 * This component uses the workbench theme's extras palette for section styling,
 * providing orange/amber colors that differentiate from the chat spine's blue.
 * 
 * Used for wrapped sections like ShortName in Room Component.
 * 
 * Uses Material UI's `sx` prop theme-aware capabilities to access theme values directly.
 */
export const WorkbenchTitledBox: FunctionComponent<WorkbenchTitledBoxProperties> = ({ title, children }) => {
    if (title) {
        return <Box
            sx={{
                border: (theme) => `2px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`, 
                borderRadius: '0.5em',
                paddingTop: "1em",
                position: "relative",
                marginTop: "1em"
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: "-1em",
                    left: "0.25em",
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
    }
    else {
        return <Box sx={{ 
            border: (theme) => `2px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`, 
            borderRadius: '0.5em' 
        }}>
            { children }
        </Box>
    }
}

export default WorkbenchTitledBox
