import { produce } from 'immer'
import { MapReducer, MapReducerState } from './reducer.d'
import { v4 as uuidv4 } from 'uuid'

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
                if (draft.tree[0]) {
                    const key = uuidv4()
                    draft.tree[0].children.push({
                        key,
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
            })
        default:
            return state
    }
}

export default mapReducer
