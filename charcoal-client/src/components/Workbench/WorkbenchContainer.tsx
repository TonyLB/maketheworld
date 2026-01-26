import React, { FunctionComponent, ReactNode, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Drawer, Dialog, useMediaQuery, useTheme, Button, ThemeProvider, Breadcrumbs, Link, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import WorkbenchContent from './WorkbenchContent'
import AssetSelector from './AssetSelector'
import { setCurrentAssetId, putWorkbenchSettings, setCurrentView, setCurrentComponentId, getCurrentView, getCurrentComponentId } from '../../slices/UI/workbench'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { getAssetZone } from '../../slices/player'
import { createWorkbenchTheme } from './workbenchTheme'
import { hasShortName, hasName } from '@tonylb/mtw-wml/ts/standardize'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'
import { SchemaOutputTag } from '@tonylb/mtw-base/ts/schema'
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

    // Build breadcrumb trail from SchemaOrganization when viewing a component
    const breadcrumbTrail = useMemo(() => {
        if (currentView !== 'component' || !currentComponentId || assetData.AssetId === 'ASSET#uninitialized') {
            return null
        }

        try {
            // Get SchemaOrganization instance
            const organization = assetData.standardForm._getSchemaOrganization()
            
            // Get component from standardForm to access its standardKey
            const component = assetData.standardForm.byUniversalId[currentComponentId as ComponentUUID]
            if (!component || !component.standardKey) {
                return null
            }

            // Build ancestry chain (doesn't include Asset - stops at undefined parent)
            const ancestryChain = organization.buildAncestryChain(component.standardKey)
            
            // Extract component names from each reference in the chain
            const componentBreadcrumbs = ancestryChain.map((reference, index) => {
                const universalKey = reference.universalKey
                if (!universalKey) {
                    return null
                }
                
                const refComponent = assetData.standardForm.byUniversalId[universalKey]
                let name = 'Untitled'
                
                if (refComponent) {
                    if (hasShortName(refComponent)) {
                        name = refComponent.shortName?._payload?.plain?.toJSON() ?? 'Untitled'
                    } else if (hasName(refComponent)) {
                        name = schemaOutputToString((unwrapSubject(refComponent.name)?.children ?? []) as GenericTree<SchemaOutputTag>)
                    } else {
                        // Fallback to key if no name available
                        const keyValue = refComponent.key
                        if (typeof keyValue === 'string') {
                            name = keyValue
                        } else if (keyValue && typeof keyValue === 'object' && 'toJSON' in keyValue) {
                            const jsonValue = (keyValue as any).toJSON()
                            name = typeof jsonValue === 'string' ? jsonValue : 'Untitled'
                        }
                    }
                }
                
                const isLast = index === ancestryChain.length - 1
                // Use tag from reference if available, otherwise derive from component
                const icon = reference.tag 
                    ? getComponentIconByTag(reference.tag, { fontSize: '1rem', verticalAlign: 'middle', marginRight: 0.5 })
                    : getComponentIcon(refComponent, { fontSize: '1rem', verticalAlign: 'middle', marginRight: 0.5 })
                
                return {
                    universalKey: universalKey as ComponentUUID,
                    name,
                    isLast,
                    isAsset: false,
                    icon
                }
            }).filter((crumb): crumb is NonNullable<typeof crumb> => crumb !== null)
            
            // Prepend Asset as first breadcrumb (buildAncestryChain doesn't include it)
            return [
                {
                    universalKey: assetData.AssetId as ComponentUUID,
                    name: assetName || 'Untitled',
                    isLast: false,
                    isAsset: true,
                    icon: getComponentIconByTag('Asset', { fontSize: '1rem', verticalAlign: 'middle', marginRight: 0.5 })
                },
                ...componentBreadcrumbs
            ]
        } catch (error) {
            console.error('Error building breadcrumb trail:', error)
            return null
        }
    }, [currentView, currentComponentId, assetData.standardForm, assetData.AssetId, assetName])

    // Handle breadcrumb navigation
    const handleBreadcrumbClick = useCallback((universalKey: ComponentUUID, isLast: boolean, isAsset: boolean) => {
        if (isLast) return // Don't navigate if it's the current component
        
        // If clicking on asset, go to asset view
        if (isAsset) {
            dispatch(setCurrentView('asset'))
            dispatch(setCurrentComponentId(null))
        } else {
            // Navigate to the clicked component
            dispatch(setCurrentView('component'))
            dispatch(setCurrentComponentId(universalKey))
        }
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
                                                {breadcrumbTrail.map((crumb, index) => (
                                                    crumb.isLast ? (
                                                        <Typography 
                                                            key={`crumb-${index}`} 
                                                            color="text.primary" 
                                                            sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Typography>
                                                    ) : (
                                                        <Link
                                                            key={`crumb-${index}`}
                                                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            underline="hover"
                                                            color="inherit"
                                                            onClick={() => handleBreadcrumbClick(crumb.universalKey as ComponentUUID, false, crumb.isAsset || false)}
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
                                background: (theme) => theme.palette.extras?.headerGradient,
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1 }}>
                                    {breadcrumbTrail && breadcrumbTrail.length > 0 ? (
                                        <>
                                            <Breadcrumbs aria-label="navigation breadcrumbs" sx={{ mb: 0.5 }}>
                                                {breadcrumbTrail.map((crumb, index) => (
                                                    crumb.isLast ? (
                                                        <Typography 
                                                            key={`crumb-${index}`} 
                                                            color="text.primary" 
                                                            sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            {crumb.icon}
                                                            {crumb.name}
                                                        </Typography>
                                                    ) : (
                                                        <Link
                                                            key={`crumb-${index}`}
                                                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            underline="hover"
                                                            color="inherit"
                                                            onClick={() => handleBreadcrumbClick(crumb.universalKey as ComponentUUID, false, crumb.isAsset || false)}
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
                </ThemeProvider>
        </Dialog>
    )
}

export default WorkbenchContainer
