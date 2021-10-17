import React, { FunctionComponent, useMemo, useReducer, useEffect } from 'react'

import useMapStyles from './useMapStyles'
import {
    MapTree,
    MapRoom,
    MapReducer,
    MapReducerState,
    VisibleMapItems
} from './maps'
import MapRoomComponent from './MapRoom'
import MapEdgeComponent from './MapEdge'
import MapDThree, { SimNode } from './MapDThree'
import { RoomGestures } from './MapGestures'

type MapAreaProps = {
    tree: MapTree;
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

const mapReducer: MapReducer = (state, action) => {
    const returnVal = (endState: MapReducerState, nodes: SimNode[]): MapReducerState => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        return {
            mapD3: endState.mapD3,
            rooms: endState.rooms.map((room) => ({
                ...room,
                ...(xyByRoomId[room.roomId] || {})
            })),
            exits: endState.exits
        }
    }
    switch(action.type) {
        case 'UPDATETREE':
            state.mapD3.update(action.tree)
            return returnVal({ mapD3: state.mapD3, ...treeToVisible(action.tree) }, state.mapD3.nodes)
        case 'TICK':
            return returnVal(state, action.nodes)
        case 'SETCALLBACK':
            state.mapD3.setCallback(action.callback)
            return state
        case 'SETNODE':
            state.mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
            return state
        case 'ENDDRAG':
            state.mapD3.endDrag()
            return state
        default:
            return state
    }
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ tree }) => {
    const localClasses = useMapStyles()

    //
    // TODO: Lift useGesture code from Map/EditMap.js, and wire it into a separate helper function here that
    // can be applied when the MapArea tool is in the correct mode (drag)
    //
    // In fact, make a whole toolbox of different gesture-spreads to apply to the room and exit objects.
    //
    //
    // TODO: Create a useReducer call here to keep a local state synchronized with the nodes of a MapDThree instance
    //
    const [{ mapD3, rooms, exits }, mapDispatch] = useReducer(mapReducer, tree, (tree: MapTree) => {
        const mapD3 = new MapDThree(tree)
        const { rooms, exits } = treeToVisible(tree)
        return { mapD3, rooms, exits }
    })
    useEffect(() => {
        mapDispatch({
            type: 'SETCALLBACK',
            callback: (nodes: SimNode[]) => { mapDispatch({ type: 'TICK', nodes }) }
        })
    }, [mapDispatch])
    useEffect(() => {
        mapDispatch({
            type: 'UPDATETREE',
            tree
        })
    }, [tree, mapDispatch])
    const roomsByRoomId = rooms.reduce<Record<string, MapRoom>>((previous, room) => ({ ...previous, [room.roomId]: room }), {})

    //
    // TODO: Use autoSizer to figure out the size of the parent div, then set an initial scale to nearly fill
    // that.  Create a non-filled background so folks can see where the artboard is.  Create wheelZoom
    // useGestures for the artboard that will allow users to dynamically change the zoom.  Adjust the
    // useDrag functionality so that it compensates for the (now explicit) zoom level.
    //
    return <svg width="600" height="400" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
        <defs>
            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                    refX='10' refY='5'>
                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
            </marker>
        </defs>
        {
            exits.map(({ fromRoomId, toRoomId }) => {
                const from = roomsByRoomId[fromRoomId]
                const fromX = from === undefined ? undefined : from.x + 300
                const fromY = from === undefined ? undefined : from.y + 200
                const to = roomsByRoomId[toRoomId]
                const toX = to === undefined ? undefined : to.x + 300
                const toY = to === undefined ? undefined : to.y + 200
                return <MapEdgeComponent
                    fromX={fromX}
                    fromY={fromY}
                    toX={toX}
                    toY={toY}
                    fromRoomId={fromRoomId}
                    toRoomId={toRoomId}
                />
            })
        }
        {
            rooms.map((room) => ({
                className: localClasses.svgLightBlue,
                contrastClassName: localClasses.svgLightBlueContrast,
                ...room,
                Name: room.name,
                PermanentId: room.roomId,
                x: room.x + 300,
                y: room.y + 200
            }))
            .map((room) => (
                <RoomGestures
                    roomId={room.roomId}
                    x={room.x}
                    y={room.y}
                    localDispatch={mapDispatch}
                >
                    <MapRoomComponent {...room} />
                </RoomGestures>
            ))
        }
    </svg>
}

export default MapArea
