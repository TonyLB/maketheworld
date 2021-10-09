import { NestedTree } from '../../DraggableTree/interfaces'

export type TestItemType = 'EXITGROUP' | 'EXIT' | 'ROOMGROUP' | 'ROOM'

export type TestItem = {
    type: TestItemType;
    name: string;
}

export type MapTree = NestedTree<TestItem>
