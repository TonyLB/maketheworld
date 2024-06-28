import { FunctionComponent, useMemo } from 'react'

import {
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import MapArea from './Area'
import MapLayers from './MapLayers'
import ToolSelect from './Area/ToolSelect'
import { useLibraryAsset } from '../../Library/Edit/LibraryAsset'
import { selectMapRooms } from '@tonylb/mtw-wml/dist/normalize/selectors/mapRooms'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import MapController from '../Controller'
import { isSchemaImage } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { StandardMap, isStandardMap } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= () => {
    const localClasses = useMapStyles()
    const { combinedStandardForm: standardForm } = useLibraryAsset()
    const { AssetId: assetKey, MapId: mapId } = useParams<{ AssetId: string; MapId: string }>()
    useAutoPin({
        href: `${(assetKey ?? 'draft') === 'draft' ? '/Draft/' : `/Library/Edit/Asset/${assetKey}/`}Map/${mapId}`,
        label: `${mapId}`,
        type: 'MapEdit',
        iconName: 'MapEdit',
        mapId: `MAP#${mapId}`,
        cascadingClose: true
    })
    const mapComponent = useMemo<StandardMap | undefined>(() => {
        const mapComponent = standardForm.byId[mapId]
        if (mapComponent && isStandardMap(mapComponent)) {
            return mapComponent
        }
        return undefined
    }, [standardForm, mapId])

    //
    // TODO: Figure out how to extract fileURL from defaultAppearances
    //
    const mapImages = useMemo<string[]>(() => (mapComponent ? mapComponent.images.map(({ data }) => (isSchemaImage(data) ? [data.key] : [])).flat(1) : []), [mapComponent])

    return <MapController mapId={mapId}>
        <div className={localClasses.grid}>
            <div className={localClasses.content} >
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                    <ToolSelect />
                </div>
                <MapArea
                    fileURL={mapImages.length ? mapImages[0] : undefined}
                />
            </div>
            <div className={localClasses.sidebar} >
                <MapLayers mapId={mapId} />
            </div>
        </div>
    </MapController>
}

export default MapEdit
