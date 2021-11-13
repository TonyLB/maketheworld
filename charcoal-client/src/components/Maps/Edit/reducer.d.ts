import { MapTree } from './maps'

export type MapReducerTypes = 'updateTree' | 'addRoom'

export type MapReducerAction = {
    type: 'updateTree';
    tree: MapTree
} | {
    type: 'addRoom';
    x: number;
    y: number;
}

export type MapReducerState = {
    tree: MapTree
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
export type MapDispatch = (action: MapReducerAction) => void
