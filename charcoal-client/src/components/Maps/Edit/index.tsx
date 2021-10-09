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
                    type: 'EXIT',
                    fromRoomId: 'Three-A-i',
                    toRoomId: 'Three-A-ii'
                },
                children: []
            },
            {
                key: 'One-B',
                item: {
                    name: 'One-B',
                    type: 'EXIT',
                    fromRoomId: 'Three-A-ii',
                    toRoomId: 'Three-A-i'
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
                        name: '3-A-1',
                        type: 'ROOM',
                        x: 300,
                        y: 200
                    },
                    children: []
                },
                {
                    key: 'Three-A-ii',
                    item: {
                        name: '3-A-2',
                        type: 'ROOM',
                        x: 400,
                        y: 200
                    },
                    children: []
                },
                {
                    key: 'Three-A-iii',
                    item: {
                        name: '3-A-3',
                        type: 'ROOM',
                        x: 200,
                        y: 200
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
            <MapArea tree={tree} />
        </div>
        <div className={localClasses.sidebar} >
            <MapLayers tree={tree} setTree={setTree} />
        </div>
    </div>
}

export default MapEdit
