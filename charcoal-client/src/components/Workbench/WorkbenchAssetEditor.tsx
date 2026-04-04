import React, { FunctionComponent, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'

import { getStatus } from '../../slices/personalAssets'
import {
    getCurrentView,
    getCurrentComponentId
} from '../../slices/UI/workbench'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import AssetEditForm from './WorkbenchAssetEditForm'
import RoomEditor from './RoomEdit/RoomEditor'
import FeatureEditor from './FeatureEdit/FeatureEditor'
import KnowledgeEditor from './KnowledgeEdit/KnowledgeEditor'
import { LayeredContextView } from './foundations/LayeredContext'
import ExampleEditor from './ExampleEdit/ExampleEditor'
import GuidanceEditor from './GuidanceEdit/GuidanceEditor'
import SituationEditor from './SituationEdit/SituationEditor'
import MarkEditor from './MarkEdit/MarkEditor'
import MapEditor from './MapEdit/MapEditor'
import CharacterEditor from './CharacterEdit/CharacterEditor'
import LensDetail from './LensEdit/LensDetail'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardMark, { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * WorkbenchAssetEditor orchestrates workbench editing views using Redux state-based navigation.
 * Replaces React Router routing with state management.
 */
export const WorkbenchAssetEditor: FunctionComponent = () => {
    const currentView = useSelector(getCurrentView)
    const currentComponentId = useSelector(getCurrentComponentId)
    const assetData = useWorkbenchAsset()
    const currentStatus = useSelector(getStatus(assetData.AssetId))

    // Handle loading states - same pattern as EditAsset
    const isReady = useMemo(() => {
        return ['FRESH', 'SCHEMADIRTY'].includes(currentStatus || '')
    }, [currentStatus])

    if (!isReady) {
        return (
            <Box sx={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        )
    }

    // Route to appropriate view based on currentView and currentComponentId.
    // Example and Guidance appear here when navigated as top-level (no siblings); when they are
    // children of a parent's ref list, currentView is 'componentLayer' and LayeredContextView renders.
    if (currentView === 'component' && currentComponentId) {
        // Derive component type from standardForm
        const component = assetData.standardForm.byUniversalId[currentComponentId as ComponentUUID]
        
        if (component instanceof StandardMap) {
            return <MapEditor />
        }
        
        if (component instanceof StandardCharacter) {
            return <CharacterEditor />
        }

        if (component instanceof StandardRoom) {
            return <RoomEditor />
        }

        if (component instanceof StandardFeature) {
            return <FeatureEditor />
        }

        if (component instanceof StandardKnowledge) {
            return <KnowledgeEditor />
        }

        if (component instanceof StandardMark) {
            return <MarkEditor />
        }

        if (component instanceof StandardExample) {
            return <ExampleEditor />
        }

        if (component instanceof StandardGuidance) {
            return <GuidanceEditor />
        }

        if (component instanceof StandardSituation) {
            return <SituationEditor />
        }

        if (component instanceof StandardLens) {
            return <LensDetail />
        }

        return <Box />
    }

    if (currentView === 'componentLayer' && currentComponentId) {
        return <LayeredContextView />
    }

    // Default to asset view
    return <AssetEditForm />
}

export default WorkbenchAssetEditor
