import { MapTree, VisibleMapItems } from '../maps'
import { SimNode } from '../MapDThree/treeToSimulation'
import { MapDThree } from '../MapDThree'

export type MapReducerActionTypes = 'TICK' | 'UPDATETREE' | 'SETCALLBACKS' | 'SETNODE' | 'STARTDRAG' | 'ENDDRAG' | 'STABILIZE'
export type MapReducerAction = {
    type: 'UPDATETREE';
    tree: MapTree;
} | {
    type: 'TICK';
    nodes: SimNode[];
} | {
    type: 'SETCALLBACKS';
    callback: any;
    stabilityCallback: any;
} | {
    type: 'SETNODE';
    roomId: string;
    x: number;
    y: number;
} | {
    type: 'STARTDRAG';
    lockThreshold: number;
} | {
    type: 'ENDDRAG';
} | {
    type: 'STABILIZE';
}
export type MapReducerState = VisibleMapItems & {
    mapD3: MapDThree;
    tree: MapTree;
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
export type MapDispatch = (action: MapReducerAction) => void

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'