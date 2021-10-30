import { NestedTree } from '../../DraggableTree/interfaces'

export type TestItemType = 'GROUP' | 'EXIT' | 'ROOM'

export type InheritedVisibilityType = "True" | "False" | 'OverrideTrue' | 'OverrideFalse'

interface MapObjectBase {
    type: TestItemType;
    name: string;
}

export interface MapRoom extends MapObjectBase {
    type: 'ROOM';
    roomId: string;
    x: number;
    y: number;
}

export interface MapExit extends MapObjectBase {
    type: 'EXIT';
    toRoomId: string;
    fromRoomId: string;
}

export interface MapGroup extends MapObjectBase {
    type: 'GROUP';
}

type TestItemBase = MapRoom | MapExit | MapGroup

export type TestItem = TestItemBase & { visible: boolean }

export type ProcessedTestItem = TestItemBase & { visible: InheritedVisibilityType }

export type MapTree = NestedTree<TestItem>
export type MapTreeEntry = NestedTreeEntry<TestItem>

export interface VisibleMapRoom extends MapRoom {
    key: string;
    zLevel: number;
}

type VisibleMapItems = {
    rooms: VisibleMapRoom[];
    exits: MapExit[];
}

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
