import { FunctionComponent, useMemo } from 'react'

import {
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import MapArea from './Area'
import MapLayers from './MapLayers'
import ToolSelect from './Area/ToolSelect'
import { useLibraryAsset } from '../../Library/Edit/LibraryAsset'
import { MapAppearance, isNormalImage } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import MapController from '../Controller'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= () => {
    const localClasses = useMapStyles()
    const { normalForm, rooms } = useLibraryAsset()
    const { AssetId: assetKey, MapId: mapId } = useParams<{ AssetId: string; MapId: string }>()
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/Map/${mapId}`,
        label: `${mapId}`,
        type: 'MapEdit',
        iconName: 'MapEdit',
        mapId: `MAP#${mapId}`,
        cascadingClose: true
    })

    //
    // TODO: Figure out how to extract fileURL from defaultAppearances
    //
    const mapImages = useMemo<string[]>(() => {
        const mapAppearances = (normalForm[mapId || '']?.appearances || []) as MapAppearance[]
        const images = mapAppearances
            .filter(({ contextStack = [] }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            .reduce<string[]>((previous, { images = [] }) => ([
                ...previous,
                ...(images
                    .map((image) => (normalForm[image]))
                    .filter(isNormalImage)
                    .map(({ fileURL = '' }) => (fileURL))
                    .filter((fileURL) => (fileURL))
                )
            ]), [] as string[])
        return images
    }, [normalForm, mapId])

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
