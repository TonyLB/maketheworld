import { MapTree } from './maps'

export type MapReducerTypes = 'updateTree'

export type MapReducerAction = {
    type: 'updateTree';
    tree: MapTree
}

export type MapReducerState = {
    tree: MapTree
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
export type MapDispatch = (action: MapReducerAction) => void
