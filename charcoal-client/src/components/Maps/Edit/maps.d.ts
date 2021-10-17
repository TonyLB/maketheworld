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
    key: string
}

type VisibleMapItems = {
    rooms: VisibleMapRoom[];
    exits: MapExit[];
}

export type MapReducerActionTypes = 'TICK' | 'UPDATETREE' | 'SETCALLBACK' | 'SETNODE' | 'ENDDRAG'
export type MapReducerAction = {
    type: 'UPDATETREE';
    tree: MapTree;
} | {
    type: 'TICK';
    nodes: SimNode[];
} | {
    type: 'SETCALLBACK';
    callback: any
} | {
    type: 'SETNODE';
    roomId: string;
    x: number;
    y: number;
} | {
    type: 'ENDDRAG';
}
export type MapReducerState = VisibleMapItems & {
    mapD3: MapDThree
}

export type MapReducer = (state: MapReducerState, action: MapReducerAction) => MapReducerState
