import { NestedTree } from '../../DraggableTree/interfaces'

export type TestItemType = 'EXITGROUP' | 'EXIT' | 'ROOMGROUP' | 'ROOM'

export type MapRoom = {
    type: 'ROOM';
    name: string;
    x: number;
    y: number;
}

export type MapExit = {
    type: 'EXIT';
    name: string;
    toRoomId: string;
    fromRoomId: string;
}

export type TestItem = MapRoom | MapExit | {
    type: 'ROOMGROUP' | 'EXITGROUP';
    name: string;
}

export type MapTree = NestedTree<TestItem>
