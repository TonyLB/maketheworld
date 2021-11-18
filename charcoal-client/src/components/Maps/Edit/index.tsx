import React, { FunctionComponent, useState, useReducer } from 'react'

import {
    useRouteMatch,
    useHistory,
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

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= ({}) => {
    const localClasses = useMapStyles()
    const { url } = useRouteMatch()
    const history = useHistory()
    const { mapId }: { mapId: string } = useParams()

    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [{ tree }, dispatch] = useReducer<MapReducer, MapTree>(
        mapReducer,
            [{
                key: 'One',
                item: {
                    name: 'One',
                    type: 'GROUP',
                    visible: true,
                },
                children: []
            }],
        (tree) => ({ tree })
    )

    return <ToolSelectContext.Provider value={toolSelected}>
        <div className={localClasses.grid}>
            <div className={localClasses.content} >
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                    <ToolSelect toolSelected={toolSelected} onChange={setToolSelected} />
                </div>
                <MapArea tree={tree} dispatch={dispatch}/>
            </div>
            <div className={localClasses.sidebar} >
                <MapLayers tree={tree} dispatch={dispatch} />
            </div>
        </div>
    </ToolSelectContext.Provider>
}

export default MapEdit
