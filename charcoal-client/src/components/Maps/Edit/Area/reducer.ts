import {
    MapTree,
    VisibleMapItems,
    MapItem,
    MapTreeEntry,
} from '../maps'
import { SimNode, MapLayer, MapLayerRoom } from '../MapDThree/baseClasses'
import { MapAreaReducer, MapAreaReducerState } from './area'
import produce from 'immer'
import { recursiveUpdate } from '../../../DraggableTree'

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

const simulationNodes = (treeEntry: MapTreeEntry): Record<string, MapLayerRoom> => {
    const { children = [], key, item } = treeEntry
    const childrenNodes = children.reduceRight<MapLayer[]>((previous: Record<string, MapLayerRoom>, child: MapTreeEntry) => ({
        ...previous,
        ...simulationNodes(child)
    }), {})
    if (item.type === 'ROOM') {
        return {
            ...childrenNodes,
            [item.roomId]: {
                id: key,
                roomId: item.roomId,
                x: item.x,
                y: item.y,
            }
        }
    }
    else {
        return childrenNodes
    }
}

type ExitRecord = { to: string; from: string; visible: boolean; }[];

const simulationExits = (treeEntry: MapTreeEntry): ExitRecord => {
    const { children = [], key, item } = treeEntry
    const childrenNodes = children.reduceRight<ExitRecord>((previous: ExitRecord, child: MapTreeEntry) => ([
        ...previous,
        ...simulationExits(child)
    ]), [])
    if (item.type === 'EXIT') {
        return [
            ...childrenNodes,
            {
                id: key,
                from: item.fromRoomId,
                to: item.toRoomId,
                visible: item.visible
            }
        ]
    }
    else {
        return childrenNodes
    }
    
}

export const treeToMapLayers = (tree: MapTree): MapLayer[] => {
    return tree.map((treeEntry) => ({
        key: treeEntry.key,
        rooms: simulationNodes(treeEntry),
        roomVisibility: {}
    }))
}

export const treeToExits = (tree: MapTree): { to: string; from: string; visible: boolean; }[] => {
    return tree.reduce<ExitRecord>((previous, treeEntry) => ([
        ...previous,
        ...simulationExits(treeEntry)
    ]), [] as ExitRecord)
}

export const mapAreaReducer: MapAreaReducer = (state, action) => {
    const returnVal = (endState: MapAreaReducerState, nodes: SimNode[]): MapAreaReducerState => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        return {
            ...endState,
            rooms: endState.rooms.map((room) => ({
                ...room,
                ...(xyByRoomId[room.roomId] || {})
            }))
        }
    }
    const stabilize = (state: MapAreaReducerState): MapAreaReducerState => {
        const previousNodesByRoomId = (state.mapD3.nodes as SimNode[]).reduce<Record<string, SimNode>>((previous, node) => {
            return {
                ...previous,
                [node.roomId]: node
            }
        }, {})
        const updatedTree: MapTree = produce<MapTree>(state.tree, draft => {
            recursiveUpdate<MapItem>(draft, (node) => {
                if (node.item.type === 'ROOM') {
                    const previous = previousNodesByRoomId[node.item.roomId]
                    if (previous && typeof previous.x !== 'undefined' && typeof previous.y !== 'undefined') {
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
            state.mapD3.update({
                roomLayers: treeToMapLayers(action.tree),
                exits: treeToExits(action.tree)
            })
            return returnVal({ ...state, ...treeToVisible(action.tree), tree: action.tree }, state.mapD3.nodes)
        case 'TICK':
            return returnVal(state, action.nodes)
        case 'SETCALLBACKS':
            state.mapD3.setCallbacks({ onTick: action.callback, onStability: action.stabilityCallback })
            return state
        case 'SETNODE':
            state.mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
            return state
        case 'ENDDRAG':
            state.mapD3.endDrag()
            return state
        case 'DRAGEXIT':
            state.mapD3.dragExit({ roomId: action.roomId, x: action.x, y: action.y, double: action.double })
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

export default mapAreaReducer