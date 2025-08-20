import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import MapDThree from "../Edit/MapDThree"
import { SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-base/ts/schema/components"
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { StandardPosition } from "@tonylb/mtw-wml/ts/standardize/components/position"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { name: GenericTree<SchemaOutputTag>, inherited?: boolean; }

export type MapTreeItem = MapTreeExit | MapTreeRoom
export const isMapTreeRoom = (node: MapTreeItem): node is MapTreeRoom => (node.tag === 'Room')
export const isMapTreeRoomWithPosition = (node: MapTreeItem): node is MapTreeRoom & { x: number; y: number } => (
    node.tag === 'Room' && (
        typeof node.x !== 'undefined' &&
        typeof node.y !== 'undefined'
    )
)

type MapContextExitDrag = {
    sourceRoomId: `ROOM#${string}`;
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
    roomId: `ROOM#${string}`;
    x: number;
    y: number;
}

type MapDispatchUpdateTree = {
    type: 'UpdateTree';
    inherited: StandardForm;
    editable: StandardForm;
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
    roomId?: `ROOM#${string}`;
    x: number;
    y: number;
}

type MapDispatchUnlockRoom = {
    type: 'UnlockRoom';
    roomId?: string;
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
    MapDispatchUnlockRoom

export type MapContextPosition = {
    position: StandardPosition;
    name: string
}

export type MapContextType = {
    mapId: `MAP#${string}`;
    UI: {
        //
        // The Map editor can conceivably need data for:
        //    - Which tool is selected in the toolbar
        //    - Whether an exit is being dragged, from where, and to where
        //    - Which context is selected in Map Layers
        //    - Which item is selected in Map Layers of Unshown Rooms
        // Updates to this data should be performed through the mapDispatch
        // function.
        //
        toolSelected: ToolSelected;
        exitDrag: MapContextExitDrag;
        itemSelected?: MapContextItemSelected;
    },
    mapD3: MapDThree,
    mapDispatch: (action: MapDispatchAction) => void;
    localPositions: MapContextPosition[];
}
