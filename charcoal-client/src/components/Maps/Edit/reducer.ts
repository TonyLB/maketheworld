import { MapReducer } from './reducer.d'

export const mapReducer: MapReducer = (state, action) => {
    switch(action.type) {
        case 'updateTree':
            return {
                ...state,
                tree: action.tree
            }
        default:
            return state
    }
}

export default mapReducer
