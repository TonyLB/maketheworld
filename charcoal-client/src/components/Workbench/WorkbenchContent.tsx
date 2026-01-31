import React, { FunctionComponent, ReactNode } from 'react'
import { Box } from '@mui/material'

interface WorkbenchContentProps {
    children: ReactNode;
}

/**
 * Flexible content wrapper for workbench.
 * 
 * This component provides a generic container that can hold:
 * - Form-based editing (Phase 2)
 * - Chat-based editing (future iteration)
 * - Other content types (tutorials, deliberation, etc.)
 * 
 * The content area is designed to be flexible and not assume any specific content type.
 */
export const Content: FunctionComponent<WorkbenchContentProps> = ({ children }) => {
    return (
        <Box
            sx={{
                flex: 1,
                overflow: 'auto',
                padding: 2
            }}
        >
            {children}
        </Box>
    )
}

export default Content
