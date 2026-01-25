import React, { FunctionComponent, ReactNode, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Box, Drawer, Dialog, useMediaQuery, useTheme, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import WorkbenchContent from './WorkbenchContent'
import AssetSelector from './AssetSelector'
import { setCurrentAssetId, putWorkbenchSettings } from '../../slices/UI/workbench'

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
    const dispatch = useDispatch()

    const handleAssetSelect = useCallback((selectedAssetId: AssetUUID) => {
        dispatch(setCurrentAssetId(selectedAssetId))
        dispatch(putWorkbenchSettings({ currentAssetId: selectedAssetId }))
    }, [dispatch])

    const handleReturnToSelection = useCallback(() => {
        dispatch(setCurrentAssetId(null))
        dispatch(putWorkbenchSettings({ currentAssetId: null }))
    }, [dispatch])

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
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                                <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                                    {assetName || 'Select an Asset'}
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
                            {assetId !== null && (
                                <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<SwapHorizIcon />}
                                    onClick={handleReturnToSelection}
                                    sx={{
                                        ml: 2,
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    Change asset
                                </Button>
                            )}
                        </Box>
                    </Box>

                    <WorkbenchContent>
                        {assetId === null ? (
                            <AssetSelector onAssetSelect={handleAssetSelect} />
                        ) : (
                            children
                        )}
                    </WorkbenchContent>

                    {/* Actions area - "Return to Story" button */}
                    <Box
                        sx={{
                            padding: 2,
                            borderTop: 1,
                            borderColor: 'divider',
                            minHeight: 64,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<ArrowBackIcon />}
                            onClick={onClose}
                            sx={{
                                minWidth: 200,
                            }}
                        >
                            Return to Story
                        </Button>
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
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                            <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                                {assetName || 'Select an Asset'}
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
                        {assetId !== null && (
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<SwapHorizIcon />}
                                onClick={handleReturnToSelection}
                                sx={{
                                    ml: 2,
                                    alignSelf: 'flex-start',
                                    minHeight: 44, // Touch-friendly on mobile
                                }}
                            >
                                Change asset
                            </Button>
                        )}
                    </Box>
                </Box>

                <WorkbenchContent>
                    {assetId === null ? (
                        <AssetSelector onAssetSelect={handleAssetSelect} />
                    ) : (
                        children
                    )}
                </WorkbenchContent>

                {/* Actions area - "Return to Story" button */}
                <Box
                    sx={{
                        padding: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                        minHeight: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        startIcon={<ArrowBackIcon />}
                        onClick={onClose}
                    >
                        Return to Story
                    </Button>
                </Box>
            </Box>
        </Dialog>
    )
}

export default WorkbenchContainer
