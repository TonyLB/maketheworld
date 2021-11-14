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

type MapItemBase = MapRoom | MapExit | MapGroup

export type MapItem = MapItemBase & { visible: boolean }

export type ProcessedTestItem = MapItemBase & { visible: InheritedVisibilityType }

export type MapTree = NestedTree<MapItem>
export type MapTreeEntry = NestedTreeEntry<MapItem>

export interface VisibleMapRoom extends MapRoom {
    key: string;
    zLevel: number;
}

type VisibleMapItems = {
    rooms: VisibleMapRoom[];
    exits: MapExit[];
}
