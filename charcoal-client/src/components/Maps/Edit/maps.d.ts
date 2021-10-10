import { NestedTree } from '../../DraggableTree/interfaces'

export type TestItemType = 'EXITGROUP' | 'EXIT' | 'ROOMGROUP' | 'ROOM'

export type InheritedVisibilityType = "True" | "False" | 'OverrideTrue' | 'OverrideFalse'

interface MapObjectBase {
    type: TestItemType;
    name: string;
}

export interface MapRoom extends MapObjectBase {
    type: 'ROOM';
    x: number;
    y: number;
}

export interface MapExit extends MapObjectBase {
    type: 'EXIT';
    toRoomId: string;
    fromRoomId: string;
}

export interface MapGroup extends MapObjectBase {
    type: 'ROOMGROUP' | 'EXITGROUP';
}

type TestItemBase = MapRoom | MapExit | MapGroup

export type TestItem = TestItemBase & { visible: boolean }

export type ProcessedTestItem = TestItemBase & { visible: InheritedVisibilityType }

export type MapTree = NestedTree<TestItem>

