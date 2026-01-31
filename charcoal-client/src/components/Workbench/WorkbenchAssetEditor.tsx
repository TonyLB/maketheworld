import React, { FunctionComponent, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'

import { getStatus } from '../../slices/personalAssets'
import {
    getCurrentView,
    getCurrentComponentId,
    getCurrentComponentLayerId,
    getCurrentAssetId
} from '../../slices/UI/workbench'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import AssetEditForm from './WorkbenchAssetEditForm'
import ComponentDetail from './WorkbenchComponentDetail'
import ExamplesView from './WorkbenchExamplesView'
import MarkEditor from './WorkbenchMarkEditor'
import MapEditor from './WorkbenchMapEditor'
import CharacterEditor from './WorkbenchCharacterEditor'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * WorkbenchAssetEditor orchestrates workbench editing views using Redux state-based navigation.
 * Replaces React Router routing with state management.
 */
export const WorkbenchAssetEditor: FunctionComponent = () => {
    const currentAssetId = useSelector(getCurrentAssetId)
    const currentView = useSelector(getCurrentView)
    const currentComponentId = useSelector(getCurrentComponentId)
    const currentComponentLayerId = useSelector(getCurrentComponentLayerId)
    const assetData = useWorkbenchAsset()
    const currentStatus = useSelector(getStatus(assetData.AssetId))

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
            return <MapEditor />
        }
        
        if (component instanceof StandardCharacter) {
            return <CharacterEditor />
        }
        
        // For Room, Feature, Knowledge, use ComponentDetail
        return <ComponentDetail />
    }

    if (currentView === 'componentLayer' && currentComponentId) {
        const layerId = currentComponentLayerId as ComponentUUID | null
        const layerComponent = layerId ? assetData.standardForm.byUniversalId[layerId] : undefined
        if (layerComponent instanceof StandardMark && layerId) {
            return <MarkEditor markId={layerId} />
        }
        return <ExamplesView />
    }

    // Default to asset view
    return <AssetEditForm />
}

export default WorkbenchAssetEditor
