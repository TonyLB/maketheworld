import React, { FunctionComponent, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import { MapGridContainer, MapContentArea, MapSidebarArea } from '../Maps/Edit/useMapStyles'
import MapArea from './MapArea'
import MapLayers from './MapLayers'
import ToolSelect from '../Maps/Edit/Area/ToolSelect'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { getCurrentComponentId, navigateViaBreadcrumbIndex } from '../../slices/UI/workbench'
import MapController from './MapController'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import TutorialPopover from '../Onboarding/TutorialPopover'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { isSchemaImage } from '@tonylb/mtw-base/ts/schema/image'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

export const MapEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)
    useOnboardingCheckpoint('editMap', { requireSequence: true })
    
    // Extract mapId from currentComponentId (remove the MAP# prefix if present)
    const mapId = useMemo<string | undefined>(() => {
        if (!currentComponentId) return undefined
        // If it's already in the format MAP#uuid, extract the uuid part
        if (currentComponentId.startsWith('MAP#')) {
            return currentComponentId.replace('MAP#', '')
        }
        return currentComponentId
    }, [currentComponentId])
    
    const mapComponent = useMemo<StandardMap | undefined>(() => {
        if (!currentComponentId) return undefined
        const component = standardForm.byUniversalId[currentComponentId as ComponentUUID]
        if (component && component instanceof StandardMap) {
            return component
        }
        // Fallback: try to find by mapId if component not found by universalKey
        if (mapId) {
            const componentById = standardForm.byId[mapId]
            if (componentById && componentById instanceof StandardMap) {
                return componentById
            }
        }
        return undefined
    }, [standardForm, currentComponentId, mapId])

    const mapImages = useMemo<string[]>(() => (mapComponent ? mapComponent.images.map(({ data }) => (isSchemaImage(data) ? [data.key] : [])).flat(1) : []), [mapComponent])
    const mapAreaRef = useRef<HTMLDivElement>(null)

    const handleBackToAsset = () => {
        dispatch(navigateViaBreadcrumbIndex(0))
    }

    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ padding: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToAsset}
                    variant="outlined"
                    size="small"
                >
                    Back to Asset
                </Button>
            </Box>
            
            <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
                <MapController mapId={(mapId ?? '') as `MAP#${string}`}>
                    <MapGridContainer>
                        <MapContentArea ref={mapAreaRef}>
                            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                                <ToolSelect />
                            </div>
                            <MapArea
                                fileURL={mapImages.length ? mapImages[0] : undefined}
                                editMode
                            />
                        </MapContentArea>
                        <MapSidebarArea>
                            <MapLayers mapId={(mapId ?? '') as `MAP#${string}`} />
                        </MapSidebarArea>
                    </MapGridContainer>
                    <TutorialPopover
                        anchorEl={mapAreaRef as any}
                        placement='right'
                        checkPoints={['positionNewRoom', 'connectNewRoom']}
                    />
                </MapController>
            </Box>
        </Box>
    )
}

export default MapEditor
