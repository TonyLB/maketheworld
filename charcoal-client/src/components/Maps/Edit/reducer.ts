import { produce } from 'immer'
import { MapReducer, MapReducerState } from './reducer.d'
import { v4 as uuidv4 } from 'uuid'
import { recursiveUpdate } from '../../DraggableTree'

export const mapReducer: MapReducer = (state, action) => {
    switch(action.type) {
        case 'updateTree':
            return {
                ...state,
                tree: action.tree
            }
        case 'addRoom':
            return produce<MapReducerState>(state, (draft) => {
                //
                // TODO: Create a more sophisticated algorithm for where to add a room
                // than simply assuming that the first element in the nested tree will be
                // a layer, and putting the room there.
                //
                if (draft.tree[0]) {
                    const key = uuidv4()
                    draft.tree[0].children.push({
                        key,
                        item: {
                            type: 'ROOM',
                            name: 'Untitled',
                            visible: true,
                            roomId: key,
                            x: action.x,
                            y: action.y
                        },
                        children: []
                    })
                }
            })
        case 'addExit':
            return produce<MapReducerState>(state, (draft) => {
                //
                // TODO: Create a more sophisticated algorithm for where to add an exit
                // than simply assuming that the first element in the nested tree will be
                // a layer, and putting the room there.
                //
                //
                // TODO: In case of double, you may be filling in one of a pair where an
                // existing exit is already present.  Scan the entire tree for exits and
                // add only what is needed.
                //
                let fromLink = false, toLink = false
                recursiveUpdate(draft.tree, ({ item }) => {
                    if (item.type === 'EXIT') {
                        if (item.fromRoomId === action.fromRoomId && item.toRoomId === action.toRoomId) {
                            fromLink = true
                        }
                        if (item.toRoomId === action.fromRoomId && item.fromRoomId === action.toRoomId) {
                            toLink = true
                        }
                    }
                })
                if (draft.tree[0] && !fromLink || (action.double && !toLink)) {
                    if (!fromLink) {
                        draft.tree[0].children.push({
                            key: uuidv4(),
                            item: {
                                type: 'EXIT',
                                name: 'Exit',
                                visible: true,
                                fromRoomId: action.fromRoomId,
                                toRoomId: action.toRoomId
                            },
                            children: []
                        })
                    }
                    if (action.double && !toLink) {
                        draft.tree[0].children.push({
                            key: uuidv4(),
                            item: {
                                type: 'EXIT',
                                name: 'Exit',
                                visible: true,
                                fromRoomId: action.toRoomId,
                                toRoomId: action.fromRoomId
                            },
                            children: []
                        })
                    }
                }
            })
        default:
            return state
    }
}

export default mapReducer
