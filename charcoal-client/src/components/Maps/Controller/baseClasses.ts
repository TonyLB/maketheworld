import { GenericTree } from "@tonylb/mtw-wml/dist/sequence/tree/baseClasses"
import { SchemaConditionTag, SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import MapDThree from "../Edit/MapDThree"
import { NormalReference } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { inherited?: boolean; reference?: NormalReference }
export type MapTreeCondition = SchemaConditionTag & { inherited?: boolean }

export type MapTreeItem = MapTreeExit | MapTreeRoom | MapTreeCondition
export const isMapTreeRoom = (node: MapTreeItem): node is MapTreeRoom => (node.tag === 'Room')
export const isMapTreeRoomWithPosition = (node: MapTreeItem): node is MapTreeRoom & { x: number; y: number; reference: NormalReference } => (
    node.tag === 'Room' && (
        typeof node.x !== 'undefined' &&
        typeof node.y !== 'undefined' &&
        Boolean(node.reference)
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
    tree: GenericTree<MapTreeItem>;
    hiddenConditions: string[];
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

type MapDispatchAddRoom = {
    type: 'AddRoom';
    roomId?: string;
    x: number;
    y: number;
}

type MapDispatchSetCursorPosition = {
    type: 'SetCursor';
    x?: number;
    y?: number;
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
    MapDispatchAddRoom |
    MapDispatchSetCursorPosition |
    MapDispatchToggleBranchVisibility

export type MapContextPosition = {
    roomId: string;
    name: string;
    x: number;
    y: number;
    reference: NormalReference;
}

export type MapContextType = {
    mapId: string;
    tree: GenericTree<MapTreeItem>;
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
        cursorPosition?: { x: number; y: number };
        hiddenBranches: string[];
    },
    mapD3: MapDThree,
    mapDispatch: (action: MapDispatchAction) => void;
    localPositions: MapContextPosition[];
}
