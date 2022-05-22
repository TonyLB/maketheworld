import { MapTree } from './maps'

export type MapReducerTypes = 'updateTree' | 'addRoom'

export type MapReducerAction = {
    type: 'updateTree';
    tree: MapTree
} | {
    type: 'addRoom';
    key: string;
    name: string;
    x: number;
    y: number;
} | {
    type: 'addExit';
    fromRoomId: string;
    toRoomId: string;
    double: boolean;
}

export type MapReducerState = {
    tree: MapTree
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
export type MapDispatch = (action: MapReducerAction) => void
