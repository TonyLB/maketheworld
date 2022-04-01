import {
    MapTree,
    VisibleMapItems,
    MapItem
} from '../maps'
import { SimNode } from '../MapDThree/baseClasses'
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
            // Alternately:  Instead of a lockThreshold, run one D3 simulation per layer, with earlier layers
            // cascading their changes forward to fixed nodes in the simulations of later layers.  Then each
            // simulation can stabilize independently (although earlier layers will almost certainly stabilize
            // first, as they won't keep having their alpha reset by cascading updates)
            //
            state.mapD3.update(action.tree)
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