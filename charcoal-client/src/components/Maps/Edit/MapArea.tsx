import React, { FunctionComponent, useReducer, useEffect } from 'react'

import useMapStyles from './useMapStyles'
import {
    MapTree,
    MapReducer,
    MapReducerState,
    VisibleMapItems,
    TestItem
} from './maps'
import MapDThree, { SimNode } from './MapDThree'
import MapDisplay from './MapDisplay'
import produce from 'immer'
import { recursiveUpdate } from '../../DraggableTree'

type MapAreaProps = {
    tree: MapTree;
}

const mergeVisibleMapItems = (...args: VisibleMapItems[]): VisibleMapItems => (
    args.reduce<VisibleMapItems>(
        ({ rooms: prevRooms, exits: prevExits }, { rooms, exits }) => ({ rooms: [...prevRooms, ...rooms ], exits: [...prevExits, ...exits ]}),
        { rooms: [], exits: [] }
    )
)

export const treeToVisible = (tree: MapTree, zLevel?: number): VisibleMapItems => {
    return tree.reduce<VisibleMapItems>((
        previous,
        { item, children, key },
        index
    ) => {
        if (!item.visible) {
            return previous
        }
        const childResult = treeToVisible(children, zLevel ?? index)
        switch(item.type) {
            case 'ROOM':
                return mergeVisibleMapItems(previous, { rooms: [{ ...item, key, zLevel: zLevel ?? index }], exits: [] }, childResult)
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
    const stabilize = (state: MapReducerState): MapReducerState => {
        const previousNodesByRoomId = (state.mapD3.nodes as SimNode[]).reduce<Record<string, SimNode>>((previous, node) => {
            return {
                ...previous,
                [node.roomId]: node
            }
        }, {})
        const updatedTree: MapTree = produce<MapTree>(state.tree, draft => {
            recursiveUpdate<TestItem>(draft, (node) => {
                if (node.item.type === 'ROOM') {
                    const previous = previousNodesByRoomId[node.item.roomId]
                    if (previous && previous.x !== undefined && previous.y !== undefined) {
                        node.item.x = previous.x
                        node.item.y = previous.y
                    }
                }
            })
        })
        return returnVal({ ...state, tree: updatedTree }, state.mapD3.nodes)
    }
    switch(action.type) {
        case 'UPDATETREE':
            //
            // TODO: Diff trees to figure out what the lockThreshold should be, given what (if anything) has
            // changed about what layers different elements are on (movement within layers means no change
            // to the D3 map, pretty sure ... which will be important to lift node positioning state up without
            // creating an infinite loop of updates causing node iterations causing updates)
            //
            state.mapD3.update(action.tree)
            return returnVal({ ...state, ...treeToVisible(action.tree), tree: action.tree }, state.mapD3.nodes)
        case 'TICK':
            return returnVal(state, action.nodes)
        case 'SETCALLBACKS':
            state.mapD3.setCallbacks(action.callback, action.stabilityCallback)
            return state
        case 'STARTDRAG':
            const newState = stabilize(state)
            newState.mapD3.update(newState.tree, action.lockThreshold)
            return newState
        case 'SETNODE':
            state.mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
            return state
        case 'ENDDRAG':
            state.mapD3.endDrag()
            return state
        case 'STABILIZE':
            //
            // TODO: Transfer nodes repositioning information into local tree state
            //
            return stabilize(state)
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
        return { mapD3, rooms, exits, tree }
    })
    useEffect(() => {
        mapDispatch({
            type: 'SETCALLBACKS',
            callback: (nodes: SimNode[]) => { mapDispatch({ type: 'TICK', nodes }) },
            stabilityCallback: () => { mapDispatch({ type: 'STABILIZE' })}
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
