import React, { FunctionComponent, useMemo, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'

import { getStatus } from '../../slices/personalAssets'
import { getCurrentView, getCurrentComponentId, getCurrentAssetId, setCurrentView, setCurrentComponentId } from '../../slices/UI/workbench'
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
    const assetData = useWorkbenchAsset()
    const currentStatus = useSelector(getStatus(assetData.AssetId))

    // Reset view to asset when asset changes (not when view changes)
    const prevAssetIdRef = useRef<AssetUUID | null>(null)
    useEffect(() => {
        if (currentAssetId && prevAssetIdRef.current !== null && prevAssetIdRef.current !== currentAssetId) {
            // Asset changed - reset view to asset
            dispatch(setCurrentView('asset'))
            dispatch(setCurrentComponentId(null))
        }
        prevAssetIdRef.current = currentAssetId
    }, [currentAssetId, dispatch])

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
