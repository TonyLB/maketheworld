import React, { FunctionComponent, useReducer, useEffect } from 'react'

import useMapStyles from './useMapStyles'
import {
    MapTree,
    MapReducer,
    MapReducerState,
    VisibleMapItems
} from './maps'
import MapDThree, { SimNode } from './MapDThree'
import MapDisplay from './MapDisplay'

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
            ...endState,
            rooms: endState.rooms.map((room) => ({
                ...room,
                ...(xyByRoomId[room.roomId] || {})
            }))
        }
    }
    switch(action.type) {
        case 'UPDATETREE':
            state.mapD3.update(action.tree)
            return returnVal({ ...state, ...treeToVisible(action.tree) }, state.mapD3.nodes)
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

    return <MapDisplay rooms={rooms} exits={exits} mapDispatch={mapDispatch} />

}

export default MapArea
