import React, { FunctionComponent, ReactNode } from 'react'
import { Box, Drawer, Dialog, useMediaQuery, useTheme } from '@mui/material'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import WorkbenchContent from './WorkbenchContent'

interface WorkbenchContainerProps {
    open: boolean;
    onClose: () => void;
    assetId: AssetUUID | null;
    assetName: string | null;
    visibilityState: string | null;
    secondaryContext?: string | null;
    children: ReactNode;
}

/**
 * Workbench container component with responsive layout.
 * 
 * Desktop (landscape, min-width: 1200px): Side panel (Drawer) on the right, ~600px wide
 * Mobile (portrait or smaller): Full-screen overlay (Dialog or temporary Drawer)
 * 
 * The workbench is positioned relative to the viewport, not relative to MessagePanel,
 * so it can overlay the entire content area regardless of what's in the main content.
 * 
 * This container is designed to accommodate:
 * - Form-based editing (Phase 2)
 * - Chat-based editing (future iteration)
 * - Other content types (tutorials, deliberation, etc.)
 */
export const WorkbenchContainer: FunctionComponent<WorkbenchContainerProps> = ({
    open,
    onClose,
    assetId,
    assetName,
    visibilityState,
    secondaryContext,
    children
}) => {
    const theme = useTheme()
    const isDesktop = useMediaQuery('(min-width: 1200px) and (orientation: landscape)')

    // Desktop: Use Drawer as side panel
    if (isDesktop) {
        return (
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                variant="persistent"
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 600,
                        boxSizing: 'border-box',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                    }}
                >
                    {/* Header will be implemented in Task 2 */}
                    <Box
                        sx={{
                            padding: 2,
                            borderBottom: 1,
                            borderColor: 'divider',
                            minHeight: 64,
                        }}
                    >
                        <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                            {assetName || 'No asset selected'}
                        </Box>
                        {visibilityState && (
                            <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                                {visibilityState}
                            </Box>
                        )}
                        {secondaryContext && (
                            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                                {secondaryContext}
                            </Box>
                        )}
                    </Box>

                    <WorkbenchContent>
                        {children}
                    </WorkbenchContent>

                    {/* Actions area - "Return to Story" will be implemented in Task 4 */}
                    <Box
                        sx={{
                            padding: 2,
                            borderTop: 1,
                            borderColor: 'divider',
                            minHeight: 64,
                        }}
                    >
                        {/* Placeholder for "Return to Story" button */}
                    </Box>
                </Box>
            </Drawer>
        )
    }

    // Mobile: Use Dialog as full-screen overlay
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: {
                    display: 'flex',
                    flexDirection: 'column',
                }
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                {/* Header will be implemented in Task 2 */}
                <Box
                    sx={{
                        padding: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        minHeight: 64,
                    }}
                >
                    <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                        {assetName || 'No asset selected'}
                    </Box>
                    {visibilityState && (
                        <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                            {visibilityState}
                        </Box>
                    )}
                    {secondaryContext && (
                        <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                            {secondaryContext}
                        </Box>
                    )}
                </Box>

                <WorkbenchContent>
                    {children}
                </WorkbenchContent>

                {/* Actions area - "Return to Story" will be implemented in Task 4 */}
                <Box
                    sx={{
                        padding: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                        minHeight: 64,
                    }}
                >
                    {/* Placeholder for "Return to Story" button */}
                </Box>
            </Box>
        </Dialog>
    )
}

export default WorkbenchContainer
