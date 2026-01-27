import React, { FunctionComponent } from 'react'
import { Box } from '@mui/material'

/**
 * WorkbenchSpacer - A simple spacer component for adding breathing room
 * between elements in the workbench.
 * 
 * Provides consistent spacing when elements aren't thematically grouped
 * (e.g., between a top-level field and accordion sections).
 */
export const WorkbenchSpacer: FunctionComponent<{
    /**
     * Height of the spacer. Defaults to '1em' for standard spacing.
     */
    height?: string | number
}> = ({ height = '1em' }) => {
    return (
        <Box sx={{ height, width: '100%' }} />
    )
}

export default WorkbenchSpacer
