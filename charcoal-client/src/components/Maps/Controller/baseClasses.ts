import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaAssetTag, SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaExitTag, SchemaNameTag, SchemaOutputTag, SchemaPositionTag, SchemaRoomTag, SchemaSelectedTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import MapDThree from "../Edit/MapDThree"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { name: GenericTree<SchemaOutputTag>, inherited?: boolean; }
export type MapTreeCondition = SchemaConditionTag & { inherited?: boolean }

export type MapTreeItem = MapTreeExit | MapTreeRoom | MapTreeCondition
export const isMapTreeRoom = (node: MapTreeItem): node is MapTreeRoom => (node.tag === 'Room')
export const isMapTreeRoomWithPosition = (node: MapTreeItem): node is MapTreeRoom & { x: number; y: number } => (
    node.tag === 'Room' && (
        typeof node.x !== 'undefined' &&
        typeof node.y !== 'undefined'
    )
)

type MapContextExitDrag = {
    sourceRoomId: string;
    x: number;
    y: number;
}

type MapDispatchSetTool = {
    type: 'SetToolSelected';
    value: ToolSelected;
}

type MapDispatchSetExitDrag = {
    type: 'SetExitDrag';
} & Partial<MapContextExitDrag>

type MapDispatchEndDrag = {
    type: 'EndDrag';
}

type MapDispatchDragExit = {
    type: 'DragExit';
    double?: boolean;
} & MapContextExitDrag

type MapDispatchSetNode = {
    type: 'SetNode',
    roomId: string;
    x: number;
    y: number;
}

type MapDispatchUpdateTree = {
    type: 'UpdateTree';
    tree: GenericTree<SchemaTag, TreeId>;
}

type MapContextItemSelectedLayer = {
    type: 'Layer';
    key: string;
}

type MapContextItemSelectedUnshown = {
    type: 'UnshownRoom';
    key: string;
}

type MapContextItemSelectedUnshownAdd = {
    type: 'UnshownRoomNew';
}

export type MapContextItemSelected = MapContextItemSelectedUnshown |
    MapContextItemSelectedUnshownAdd |
    MapContextItemSelectedLayer

type MapDispatchSelectItem = {
    type: 'SelectItem';
    item?: MapContextItemSelected;
}

type MapDispatchSelectParent = {
    type: 'SelectParent';
    item?: string;
}

type MapDispatchAddRoom = {
    type: 'AddRoom';
    roomId?: string;
    x: number;
    y: number;
}

type MapDispatchUnlockRoom = {
    type: 'UnlockRoom';
    roomId?: string;
}

type MapDispatchToggleBranchVisibility = {
    type: 'ToggleVisibility';
    key: string;
}

export type MapDispatchAction = MapDispatchSetTool |
    MapDispatchSetExitDrag |
    MapDispatchEndDrag |
    MapDispatchDragExit |
    MapDispatchSetNode |
    MapDispatchUpdateTree |
    MapDispatchSelectItem |
    MapDispatchSelectParent |
    MapDispatchAddRoom |
    MapDispatchUnlockRoom |
    MapDispatchToggleBranchVisibility

export type MapContextPosition = {
    id: string;
    parentId: string;
    roomId: string;
    name: string;
    x: number;
    y: number;
}

export type MapTreeSchemaTags = SchemaAssetTag | SchemaSelectedTag | SchemaExitTag | SchemaNameTag | SchemaRoomTag | SchemaPositionTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaOutputTag

export type MapContextType = {
    mapId: string;
    nodeId: string;
    tree: GenericTree<MapTreeSchemaTags, TreeId>;
    selectedPositions: GenericTree<MapTreeSchemaTags>;
    updateSelected: (newValue: GenericTree<SchemaTag>) => void;
    UI: {
        //
        // The Map editor can conceivably need data for:
        //    - Which tool is selected in the toolbar
        //    - Whether an exit is being dragged, from where, and to where
        //    - Which context is selected in Map Layers
        //    - Which item is selected in Map Layers of Unshown Rooms
        //    - The current hover position of the cursor (if any) over the display
        //    - Which condition branches are set invisible
        // Updates to this data should be performed through the mapDispatch
        // function.
        //
        toolSelected: ToolSelected;
        exitDrag: MapContextExitDrag;
        itemSelected?: MapContextItemSelected;
        parentID?: string;
    },
    mapD3: MapDThree,
    mapDispatch: (action: MapDispatchAction) => void;
    localPositions: MapContextPosition[];
}
