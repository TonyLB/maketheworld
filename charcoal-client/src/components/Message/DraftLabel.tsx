import React, { FunctionComponent } from 'react'
import { Box, Typography } from '@mui/material'
import LanguageIcon from '@mui/icons-material/Language'

/**
 * DraftLabel - UI Placeholder for Draft Worldview Indicator
 * 
 * This component displays a "Draft" label in the play spine UI to indicate
 * when the user is viewing a draft worldview. This is a UI placeholder only.
 * 
 * **IMPORTANT**: This is a placeholder implementation. The actual draft worldview
 * rendering depends on backend message/perception system refactor. When backend
 * supports draft worldview selection, this component should be updated to:
 * - Conditionally render based on worldview state from Redux/backend
 * - Display current worldview type (Draft, Canon, etc.)
 * - Convert to a select/dropdown element for worldview switching (future Phase)
 * 
 * See: AGENT.chatSpine.planning.md - Phase 1, Task 4
 */
export const DraftLabel: FunctionComponent = () => {
    // For now, always show "Draft" as a placeholder
    // TODO: Replace with conditional rendering based on worldview state when backend supports it
    // TODO: Convert to select element for worldview switching when backend supports it
    const showDraft = true
    
    if (!showDraft) {
        return null
    }
    
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                paddingLeft: '10px',
                paddingRight: '10px',
                minWidth: '80px', // Wide enough to accommodate select element later
                gap: '6px', // Space between icon and text
                // Match font size of TextField input (default Material-UI body1)
                fontSize: '1rem',
                color: 'text.secondary',
                // Style to indicate it will become interactive (select) later
                cursor: 'default', // Will become 'pointer' when select is implemented
                '&:hover': {
                    color: 'text.primary'
                }
            }}
        >
            <LanguageIcon 
                sx={{ 
                    fontSize: '1.25rem', // Slightly larger than text for visual balance
                    color: 'inherit'
                }} 
            />
            <Typography
                variant="body1"
                sx={{
                    fontSize: 'inherit',
                    fontWeight: 500,
                    userSelect: 'none'
                }}
            >
                Draft
            </Typography>
        </Box>
    )
}

export default DraftLabel
