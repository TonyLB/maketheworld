import React, { FunctionComponent, useMemo } from 'react'

import {
    useRouteMatch,
    useHistory,
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import { MapTree, MapRoom, MapExit } from './maps'
import MapRoomComponent from './MapRoom'
import MapEdgeComponent from './MapEdge'

type MapAreaProps = {
    tree: MapTree;
}

interface VisibleMapRoom extends MapRoom {
    key: string
}

type VisibleMapItems = {
    rooms: VisibleMapRoom[];
    exits: MapExit[];
}

const mergeVisibleMapItems = (...args: VisibleMapItems[]): VisibleMapItems => (
    args.reduce<VisibleMapItems>(
        ({ rooms: prevRooms, exits: prevExits }, { rooms, exits }) => ({ rooms: [...prevRooms, ...rooms ], exits: [...prevExits, ...exits ]}),
        { rooms: [], exits: [] }
    )
)

export const treeToVisible = (tree: MapTree): VisibleMapItems => {
    return tree.reduce<VisibleMapItems>((
        previous,
        { item, children, key }
    ) => {
        if (!item.visible) {
            return previous
        }
        const childResult = treeToVisible(children)
        switch(item.type) {
            case 'ROOM':
                return mergeVisibleMapItems(previous, { rooms: [{ ...item, key }], exits: [] }, childResult)
            case 'EXIT':
                return mergeVisibleMapItems(previous, { rooms: [], exits: [item] }, childResult)
            default:
                return mergeVisibleMapItems(previous, childResult)
        }
    }, { rooms: [], exits: [] })
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ tree }) => {
    const localClasses = useMapStyles()

    const { rooms, exits } = useMemo<VisibleMapItems>(() => (treeToVisible(tree)), [tree])
    const roomsByKey = rooms.reduce<Record<string, MapRoom>>((previous, { key, ...rest }) => ({ ...previous, [key]: rest }), {})

    return <svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
        <defs>
            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                    refX='10' refY='5'>
                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
            </marker>
        </defs>
        {
            exits.map(({ fromRoomId, toRoomId }) => (<MapEdgeComponent
                    fromX={roomsByKey[fromRoomId]?.x}
                    fromY={roomsByKey[fromRoomId]?.y}
                    toX={roomsByKey[toRoomId]?.x}
                    toY={roomsByKey[toRoomId]?.y}
                    fromRoomId={fromRoomId}
                    toRoomId={toRoomId}
                />
            ))
        }
        {
            rooms.map((room) => ({
                className: localClasses.svgLightBlue,
                contrastClassName: localClasses.svgLightBlueContrast,
                ...room,
                Name: room.name,
                PermanentId: room.name
            }))
            .map(MapRoomComponent)
        }
    </svg>
}

export default MapArea
