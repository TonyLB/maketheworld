import React, { FunctionComponent, useState } from 'react'

import {
    useRouteMatch,
    useHistory,
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import MapArea from './MapArea'
import MapLayers from './MapLayers'
import { MapTree } from './maps'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= ({}) => {
    const localClasses = useMapStyles()
    const { url } = useRouteMatch()
    const history = useHistory()
    const { mapId }: { mapId: string } = useParams()

    const [tree, setTree] = useState<MapTree>(
        [{
            key: 'One',
            item: {
                name: 'One',
                type: 'EXITGROUP'
            },
            children: [{
                key: 'One-A',
                item: {
                    name: 'One-A',
                    type: 'EXIT'
                },
                children: []
            },
            {
                key: 'One-B',
                item: {
                    name: 'One-B',
                    type: 'EXIT'
                },
                children: []
            }]
        },
        {
            key: 'Two',
            item: {
                name: 'Two',
                type: 'EXITGROUP'
            },
            children: []
        },
        {
            key: 'Three',
            item: {
                name: 'Three',
                type: 'ROOMGROUP'
            },
            children: [{
                key: 'Three-A',
                item: {
                    name: 'Three-A',
                    type: 'ROOMGROUP'
                },
                children: [{
                    key: 'Three-A-i',
                    item: {
                        name: 'Three-A-i',
                        type: 'ROOM'
                    },
                    children: []
                },
                {
                    key: 'Three-A-ii',
                    item: {
                        name: 'Three-A-ii',
                        type: 'ROOM'
                    },
                    children: []
                }]
            },
            {
                key: 'Three-B',
                item: {
                    name: 'Three-B',
                    type: 'ROOMGROUP'
                },
                children: []
            }]
        }]
    )

    return <div className={localClasses.grid}>
        <div className={localClasses.content} >
            <MapArea />
        </div>
        <div className={localClasses.sidebar} >
            <MapLayers tree={tree} setTree={setTree} />
        </div>
    </div>
}

export default MapEdit
