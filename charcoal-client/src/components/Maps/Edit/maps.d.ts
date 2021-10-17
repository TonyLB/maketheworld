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
