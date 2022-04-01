import { MapTree, VisibleMapItems } from '../maps'
import { SimNode } from '../MapDThree/baseClasses'
import { MapDThree } from '../MapDThree'

export type MapAreaReducerActionTypes = 'TICK' | 'UPDATETREE' | 'SETCALLBACKS' | 'SETNODE' | 'STARTDRAG' | 'ENDDRAG' | 'STABILIZE'
export type MapAreaReducerAction = {
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
    type: 'DRAGEXIT';
    roomId: string;
    x: number;
    y: number;
    double: boolean;
} | {
    type: 'ENDDRAG';
} | {
    type: 'STABILIZE';
}
export type MapAreaReducerState = VisibleMapItems & {
    mapD3: MapDThree;
    tree: MapTree;
}

export type MapAreaReducer = (state: MapAreaReducerState, action: MapAreaReducerAction) => MapAreaReducerState
export type MapAreaDispatch = (action: MapAreaReducerAction) => void

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'