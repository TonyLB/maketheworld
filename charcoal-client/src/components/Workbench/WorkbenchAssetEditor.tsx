import React, { FunctionComponent, useMemo, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'

import { getStatus } from '../../slices/personalAssets'
import {
    getCurrentView,
    getCurrentComponentId,
    getCurrentAssetId,
    setCurrentView,
    setCurrentComponentId,
    getBreadcrumbStack,
    pushBreadcrumb,
    popBreadcrumbToIndex
} from '../../slices/UI/workbench'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import WorkbenchAssetEditForm from './WorkbenchAssetEditForm'
import WorkbenchComponentDetail from './WorkbenchComponentDetail'
import WorkbenchMapEditor from './WorkbenchMapEditor'
import WorkbenchCharacterEditor from './WorkbenchCharacterEditor'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * WorkbenchAssetEditor orchestrates workbench editing views using Redux state-based navigation.
 * Replaces React Router routing with state management.
 */
export const WorkbenchAssetEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const currentAssetId = useSelector(getCurrentAssetId)
    const currentView = useSelector(getCurrentView)
    const currentComponentId = useSelector(getCurrentComponentId)
    const breadcrumbStack = useSelector(getBreadcrumbStack)
    const assetData = useWorkbenchAsset()
    const currentStatus = useSelector(getStatus(assetData.AssetId))

    // Reset view to asset when asset changes (not when view changes)
    const prevAssetIdRef = useRef<AssetUUID | null>(null)
    useEffect(() => {
        if (currentAssetId && prevAssetIdRef.current !== null && prevAssetIdRef.current !== currentAssetId) {
            // Asset changed at runtime (e.g., user chose a different asset while workbench was open).
            // The slice will already have initialized an asset-level breadcrumb; here we make sure
            // the view matches that root.
            dispatch(setCurrentView('asset'))
            dispatch(setCurrentComponentId(null))
        }
        prevAssetIdRef.current = currentAssetId
    }, [currentAssetId, dispatch])

    //
    // Keep breadcrumb history in sync with navigation state.
    //
    // The reducer owns the low-level stack operations (push / pop-to-index); this effect observes
    // currentView/currentComponentId and applies those primitives to model a simple navigation history:
    // - entering a component view pushes a component breadcrumb
    // - returning to the asset view trims the stack back to the asset breadcrumb
    //
    // Future sibling-navigation flows (for example, clicking a Feature link inside a room-example
    // description) can build on these same primitives by dispatching an explicit pop followed by a
    // push to represent \"jump sideways\" rather than a deep dive. Keeping the logic here small and
    // explicit should make those evolutions straightforward.
    //
    const prevViewRef = useRef<'asset' | 'component' | null>(null)
    const prevComponentIdRef = useRef<string | null>(null)

    useEffect(() => {
        const lastCrumb = breadcrumbStack[breadcrumbStack.length - 1]

        if (currentView === 'asset' && currentAssetId) {
            // Trim back to the asset breadcrumb when returning to asset view.
            const assetIndex = breadcrumbStack.findIndex(
                (entry) => entry.kind === 'asset' && entry.id === currentAssetId
            )
            if (assetIndex >= 0 && assetIndex < breadcrumbStack.length - 1) {
                dispatch(popBreadcrumbToIndex(assetIndex))
            }
        }

        if (currentView === 'component' && currentComponentId) {
            // Push a new component breadcrumb when we navigate into a component.
            if (!(lastCrumb && lastCrumb.kind === 'component' && lastCrumb.id === currentComponentId)) {
                dispatch(pushBreadcrumb({
                    id: currentComponentId,
                    kind: 'component',
                    componentId: currentComponentId
                }))
            }
        }

        prevViewRef.current = currentView
        prevComponentIdRef.current = currentComponentId
    }, [breadcrumbStack, currentView, currentComponentId, currentAssetId, dispatch])

    // Handle loading states - same pattern as EditAsset
    const isReady = useMemo(() => {
        return ['FRESH', 'WMLDIRTY', 'SCHEMADIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || '')
    }, [currentStatus])

    if (!isReady) {
        return (
            <Box sx={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        )
    }

    // Route to appropriate view based on currentView and currentComponentId
    if (currentView === 'component' && currentComponentId) {
        // Derive component type from standardForm
        const component = assetData.standardForm.byUniversalId[currentComponentId as ComponentUUID]
        
        if (component instanceof StandardMap) {
            return <WorkbenchMapEditor />
        }
        
        if (component instanceof StandardCharacter) {
            return <WorkbenchCharacterEditor />
        }
        
        // For Room, Feature, Knowledge, use WorkbenchComponentDetail
        return <WorkbenchComponentDetail />
    }

    // Default to asset view
    return <WorkbenchAssetEditForm />
}

export default WorkbenchAssetEditor
