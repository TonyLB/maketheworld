import { MapTree } from './maps'

export type MapReducerTypes = 'updateTree' | 'addRoom' | 'addLayer'

export type MapReducerAction = {
    type: 'updateTree';
    tree: MapTree
} | {
    type: 'updateNodes';
    repositioningById: Record<string, { x: number, y: number }>
} | {
    type: 'addRoom';
    x: number;
    y: number;
} | {
    type: 'addExit';
    fromRoomId: string;
    toRoomId: string;
    double: boolean;
} | {
    type: 'addLayer';
}

export type MapReducerState = {
    tree: MapTree
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
export type MapDispatch = (action: MapReducerAction) => void
