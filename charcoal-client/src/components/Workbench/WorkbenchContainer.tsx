import React, { FunctionComponent, ReactNode, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Drawer, Dialog, useMediaQuery, useTheme, Button, ThemeProvider, Breadcrumbs, Link, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import LayersIcon from '@mui/icons-material/Layers'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import Content from './WorkbenchContent'
import AssetSelector from './AssetSelector'
import {
    setCurrentAssetId,
    putWorkbenchSettings,
    getCurrentView,
    getCurrentComponentId,
    getNavigationTrail,
    navigateViaBreadcrumbIndex
} from '../../slices/UI/workbench'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { getAssetZone } from '../../slices/player'
import { createWorkbenchTheme } from './workbenchTheme'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import { isReferenceListChild, isSituationFacetChild } from './foundations/LayeredContext/layeredContextUtils'
import { componentDisplayLabel } from '../../lib/componentDisplayLabel'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { getComponentIcon, getComponentIconByTag } from '../../lib/componentIcons'

interface WorkbenchContainerProps {
    open: boolean;
    onClose: () => void;
    assetId: AssetUUID | null;
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
    secondaryContext,
    children
}) => {
    const baseTheme = useTheme()
    const isDesktop = useMediaQuery('(min-width: 1200px) and (orientation: landscape)')
    const dispatch = useDispatch()
    
    // Read current view and component ID from Redux state
    const currentView = useSelector(getCurrentView)
    const currentComponentId = useSelector(getCurrentComponentId)
    const navigationTrail = useSelector(getNavigationTrail)
    
    // Create workbench theme that extends the base theme
    // This allows the workbench to have a distinctive appearance
    const workbenchTheme = useMemo(() => createWorkbenchTheme(baseTheme), [baseTheme])
    
    // Use workbench asset hook to get asset data
    const assetData = useWorkbenchAsset()
    
    // Derive asset name from standardForm
    // standardForm.shortName is a StandardLiteral object, use toJSON() to get string value
    const assetName = useMemo<string | null>(() => {
        if (!assetId || assetData.AssetId === 'ASSET#uninitialized') {
            return null
        }
        
        // Use toJSON() to get the string value from StandardLiteral
        // toJSON() can return string or StandardEditableData<string>, so we need to handle both
        const nameResult = assetData.standardForm.shortName?.toJSON()
        if (typeof nameResult === 'string') {
            return nameResult || 'Untitled'
        }
        // If it's StandardEditableData, extract the plain data if available
        if (nameResult && typeof nameResult === 'object' && 'tag' in nameResult) {
            // For Remove/Replace, we can't display them directly, so use fallback
            return 'Untitled'
        }
        return 'Untitled'
    }, [assetId, assetData.standardForm, assetData.AssetId])
    
    // Get zone directly using selector (needed for visibility state)
    const zone = useSelector(getAssetZone(assetData.AssetId))
    
    // Derive visibility state from zone (same logic as getWorkbenchAssetInfo selector)
    const visibilityState = useMemo(() => {
        if (!assetId || assetData.AssetId === 'ASSET#uninitialized') {
            return null
        }
        
        return zone === 'Draft' ? 'Private draft' : 
               zone === 'Personal' ? 'Personal' : 
               zone === 'Library' ? 'Library' : 
               zone === 'Canon' ? 'Canon' : 
               'Unknown'
    }, [assetId, assetData.AssetId, zone])

    const handleAssetSelect = useCallback((selectedAssetId: AssetUUID) => {
        dispatch(setCurrentAssetId(selectedAssetId))
        dispatch(putWorkbenchSettings({ currentAssetId: selectedAssetId }))
        // Asset loading is now handled automatically by useWorkbenchAsset hook
    }, [dispatch])

    const handleReturnToSelection = useCallback(() => {
        dispatch(setCurrentAssetId(null))
        dispatch(putWorkbenchSettings({ currentAssetId: null }))
    }, [dispatch])

    //
    // Build breadcrumb trail from **navigation history** rather than schema ancestry.
    //
    // The workbench slice maintains a stack of breadcrumb entries that encode how the user
    // arrived at the current view (asset → room → feature, etc.). We resolve those entries
    // into labels and icons here using the current asset's standardForm.
    //
    // In future we may allow more complex sibling-navigation steps (for example, clicking a
    // Feature link from inside a room-example description) which would map to \"pop some
    // breadcrumbs, then push a different branch\". The underlying stack model and this
    // resolution path are intentionally simple so that richer behaviors can be layered on
    // later without rewriting the header.
    //
    const breadcrumbTrail = useMemo(() => {
        if (!assetId || assetData.AssetId === 'ASSET#uninitialized') {
            return null
        }

        if (!navigationTrail.length) {
            return null
        }

        return navigationTrail.map((entry, index) => {
            const isLast = index === navigationTrail.length - 1

            // Asset root crumb: derived from current asset id; componentId is null.
            if (index === 0) {
                return {
                    universalKey: assetData.AssetId as ComponentUUID,
                    name: assetName || 'Untitled',
                    isLast,
                    isAsset: true,
                    icon: getComponentIconByTag('Asset', { fontSize: '1rem', verticalAlign: 'middle', marginRight: 0.5 }),
                    index
                }
            }

            const prevComponentId = index >= 1 ? (navigationTrail[index - 1].componentId as ComponentUUID | null) : null
            const isSituationFacetLayer = isSituationFacetChild(assetData.standardForm, prevComponentId, entry.componentId as ComponentUUID | null)
            if (isSituationFacetLayer) {
                const layerId = entry.componentId as ComponentUUID | null
                const layerComponent = layerId ? assetData.standardForm.byUniversalId[layerId] : undefined
                const name = layerComponent instanceof StandardSituation
                    ? componentDisplayLabel(layerComponent, { standardForm: assetData.standardForm, fallbackLabel: 'Situation' })
                    : 'Situation'
                return {
                    universalKey: (layerId || assetData.AssetId) as ComponentUUID,
                    name,
                    isLast,
                    isAsset: false,
                    icon: <LayersIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />,
                    index
                }
            }
            const isLayerCrumb = isReferenceListChild(assetData.standardForm, prevComponentId, entry.componentId as ComponentUUID | null)
            if (isLayerCrumb) {
                const layerId = entry.componentId as ComponentUUID | null
                const layerComponent = layerId ? assetData.standardForm.byUniversalId[layerId] : undefined
                const isGuidance = layerComponent instanceof StandardGuidance
                const sn = isGuidance ? layerComponent.shortName?._payload?.plain?.toJSON() : undefined
                const name = isGuidance
                    ? (typeof sn === 'string' && sn.trim() ? sn : 'Guidance')
                    : 'Guidance'
                return {
                    universalKey: (layerId || assetData.AssetId) as ComponentUUID,
                    name,
                    isLast,
                    isAsset: false,
                    icon: <LayersIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />,
                    index
                }
            }

            // Component breadcrumb: look up the component for naming and icon.
            const universalKey = entry.componentId as ComponentUUID | null
            const refComponent = universalKey ? assetData.standardForm.byUniversalId[universalKey] : undefined
            const name = refComponent
                ? componentDisplayLabel(refComponent, { standardForm: assetData.standardForm, fallbackLabel: 'Untitled' })
                : 'Untitled'

            const icon = getComponentIcon(refComponent, { fontSize: '1rem', verticalAlign: 'middle', marginRight: 0.5 })

            return {
                universalKey: (universalKey || assetData.AssetId) as ComponentUUID,
                name,
                isLast,
                isAsset: false,
                icon,
                index
            }
        })
    }, [assetId, assetData.AssetId, assetData.standardForm, assetName, navigationTrail])

    // Handle breadcrumb navigation
    const handleBreadcrumbClick = useCallback((universalKey: ComponentUUID, isLast: boolean, isAsset: boolean, index: number) => {
        if (isLast) return // Don't navigate if it's the current component
        
        // Clicking a breadcrumb represents \"go back to this step\" in the navigation
        // history; navigation state (view, current component, etc.) is derived from
        // the resulting breadcrumb stack.
        dispatch(navigateViaBreadcrumbIndex(index))
    }, [dispatch])

    // Get current component key for display
    const currentComponentKey = useMemo<string | null>(() => {
        if (currentView !== 'component' || !currentComponentId) {
            return null
        }
        const component = assetData.standardForm.byUniversalId[currentComponentId as ComponentUUID]
        if (!component) return null
        // Convert key to string if it exists
        // component.key might be StandardEditableData<string> or string, so we need to handle both
        const key = component.key
        if (typeof key === 'string') {
            return key
        }
        // If it's StandardEditableData, try to extract string value
        if (key && typeof key === 'object' && 'toJSON' in key) {
            const jsonValue = (key as any).toJSON()
            return typeof jsonValue === 'string' ? jsonValue : null
        }
        return null
    }, [currentView, currentComponentId, assetData.standardForm])

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
                <ThemeProvider theme={workbenchTheme}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                        }}
                    >
                        {/* Workbench header */}
                        <Box
                            sx={{
                                padding: 2,
                                borderBottom: 1,
                                borderColor: 'divider',
                                minHeight: 64,
                                display: 'flex',
                                flexDirection: 'column',
                                background: (theme) => (theme.palette as any).extras.headerGradient,
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1 }}>
                                    {breadcrumbTrail && breadcrumbTrail.length > 0 ? (
                                        <>
                                            <Breadcrumbs aria-label="navigation breadcrumbs" sx={{ mb: 0.5 }}>
                                                {breadcrumbTrail.map((crumb) => (
                                                    crumb.isLast ? (
                                                        <Typography 
                                                            key={`crumb-${crumb.index}`} 
                                                            color="text.primary" 
                                                            sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Typography>
                                                    ) : (
                                                        <Link
                                                            key={`crumb-${crumb.index}`}
                                                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            underline="hover"
                                                            color="inherit"
                                                            onClick={() => handleBreadcrumbClick(crumb.universalKey as ComponentUUID, false, crumb.isAsset || false, crumb.index)}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Link>
                                                    )
                                                ))}
                                            </Breadcrumbs>
                                            {currentComponentKey && (
                                                <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                                                    {currentComponentKey}
                                                </Box>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                                                {assetName || 'Select an Asset'}
                                            </Box>
                                            {visibilityState && (
                                                <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                                                    {visibilityState}
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {secondaryContext && (
                                        <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                                            {secondaryContext}
                                        </Box>
                                    )}
                                </Box>
                                {assetId !== null && currentView !== 'component' && (
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

                        <Content>
                            {assetId === null ? (
                                <AssetSelector onAssetSelect={handleAssetSelect} />
                            ) : (
                                children
                            )}
                        </Content>

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
                </ThemeProvider>
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
                <ThemeProvider theme={workbenchTheme}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                        }}
                    >
                        {/* Workbench header */}
                        <Box
                            sx={{
                                padding: 2,
                                borderBottom: 1,
                                borderColor: 'divider',
                                minHeight: 64,
                                display: 'flex',
                                flexDirection: 'column',
                                background: (theme) => (theme.palette as any).extras.headerGradient,
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1 }}>
                                    {breadcrumbTrail && breadcrumbTrail.length > 0 ? (
                                        <>
                                            <Breadcrumbs aria-label="navigation breadcrumbs" sx={{ mb: 0.5 }}>
                                                {breadcrumbTrail.map((crumb) => (
                                                    crumb.isLast ? (
                                                        <Typography 
                                                            key={`crumb-${crumb.index}`} 
                                                            color="text.primary" 
                                                            sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Typography>
                                                    ) : (
                                                        <Link
                                                            key={`crumb-${crumb.index}`}
                                                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            underline="hover"
                                                            color="inherit"
                                                            onClick={() => handleBreadcrumbClick(crumb.universalKey as ComponentUUID, false, crumb.isAsset || false, crumb.index)}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Link>
                                                    )
                                                ))}
                                            </Breadcrumbs>
                                            {currentComponentKey && (
                                                <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                                                    {currentComponentKey}
                                                </Box>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Box sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                                                {assetName || 'Select an Asset'}
                                            </Box>
                                            {visibilityState && (
                                                <Box sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>
                                                    {visibilityState}
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {secondaryContext && (
                                        <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                                            {secondaryContext}
                                        </Box>
                                    )}
                                </Box>
                                {assetId !== null && currentView !== 'component' && (
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

                        <Content>
                            {assetId === null ? (
                                <AssetSelector onAssetSelect={handleAssetSelect} />
                            ) : (
                                children
                            )}
                        </Content>

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
                </ThemeProvider>
        </Dialog>
    )
}

export default WorkbenchContainer
