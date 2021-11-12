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

type MapEditProps = {
}

// type MapReducerActionTypes = 'update' | 'addRoom'

// type MapReducerAction = {
//     type: 'update';
//     newTree: MapTree;
// } | {
//     type: 'addRoom';
//     newRoom:
// }

// const MapEditReducer = (state: MapTree, )
export const MapEdit: FunctionComponent<MapEditProps>= ({}) => {
    const localClasses = useMapStyles()
    const { url } = useRouteMatch()
    const history = useHistory()
    const { mapId }: { mapId: string } = useParams()

    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [tree, setTree] = useState<MapTree>(
        [{
            key: 'One',
            item: {
                name: 'One',
                type: 'GROUP',
                visible: true,
            },
            children: []
        },
        {
            key: 'Two',
            item: {
                name: 'Two',
                type: 'GROUP',
                visible: true,
            },
            children: []
        },
        {
            key: 'Three',
            item: {
                name: 'Three',
                type: 'GROUP',
                visible: true,
            },
            children: [{
                key: 'Three-A',
                item: {
                    name: 'Three-A',
                    type: 'GROUP',
                    visible: true,
                },
                children: [{
                    key: 'One-A',
                    item: {
                        name: 'One-A',
                        type: 'EXIT',
                        fromRoomId: 'ABC',
                        toRoomId: 'DEF',
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'One-B',
                    item: {
                        name: 'One-B',
                        type: 'EXIT',
                        fromRoomId: 'DEF',
                        toRoomId: 'ABC',
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'One-C',
                    item: {
                        name: 'One-C',
                        type: 'EXIT',
                        fromRoomId: 'ABC',
                        toRoomId: 'GHI',
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'One-D',
                    item: {
                        name: 'One-D',
                        type: 'EXIT',
                        fromRoomId: 'GHI',
                        toRoomId: 'ABC',
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'Three-A-i',
                    item: {
                        name: '3-A-1',
                        type: 'ROOM',
                        roomId: 'ABC',
                        x: 0,
                        y: 0,
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'Three-A-ii',
                    item: {
                        name: '3-A-2',
                        type: 'ROOM',
                        roomId: 'DEF',
                        x: 100,
                        y: 0,
                        visible: true,
                    },
                    children: []
                },
                {
                    key: 'Three-A-iii',
                    item: {
                        name: '3-A-3',
                        type: 'ROOM',
                        roomId: 'GHI',
                        x: -100,
                        y: 0,
                        visible: true,
                    },
                    children: []
                }]
            },
            {
                key: 'Three-B',
                item: {
                    name: 'Three-B',
                    type: 'GROUP',
                    visible: true,
                },
                children: []
            }]
        }]
    )

    return <ToolSelectContext.Provider value={toolSelected}>
        <div className={localClasses.grid}>
            <div className={localClasses.content} >
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                    <ToolSelect toolSelected={toolSelected} onChange={setToolSelected} />
                </div>
                <MapArea tree={tree}/>
            </div>
            <div className={localClasses.sidebar} >
                <MapLayers tree={tree} setTree={setTree} />
            </div>
        </div>
    </ToolSelectContext.Provider>
}

export default MapEdit
