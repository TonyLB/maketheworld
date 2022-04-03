import React, { FunctionComponent, useState, useReducer, useCallback } from 'react'

import {
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import MapArea from './Area'
import MapLayers from './MapLayers'
import { MapTree } from './maps'
import { ToolSelected } from './Area/area'
import ToolSelect from './Area/ToolSelect'
import ToolSelectContext from './Area/ToolSelectContext'
import { MapReducer } from './reducer.d'
import mapReducer from './reducer'
import { useLibraryAsset } from '../../Library/Edit/LibraryAsset'
import normalToTree from './normalToTree'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= () => {
    const localClasses = useMapStyles()
    const { normalForm, rooms } = useLibraryAsset()
    const { MapId: mapId } = useParams<{ MapId: string }>()

    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [{ tree }, dispatch] = useReducer<MapReducer, MapTree>(
        mapReducer,
        normalToTree({ MapId: mapId || '', normalForm, rooms }),
        (tree) => ({ tree })
    )
    const onStabilize = useCallback((values) => {
        console.log(`Stabilized: Tree: ${JSON.stringify(values, null, 4)}`)
        console.log(`Rooms: ${JSON.stringify(normalForm[mapId || ''], null, 4)}`)
    }, [])

    return <ToolSelectContext.Provider value={toolSelected}>
        <div className={localClasses.grid}>
            <div className={localClasses.content} >
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                    <ToolSelect toolSelected={toolSelected} onChange={setToolSelected} />
                </div>
                <MapArea tree={tree} dispatch={dispatch} onStabilize={onStabilize} />
            </div>
            <div className={localClasses.sidebar} >
                <MapLayers tree={tree} dispatch={dispatch} />
            </div>
        </div>
    </ToolSelectContext.Provider>
}

export default MapEdit
