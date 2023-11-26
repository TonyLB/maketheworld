import { GenericTree } from "@tonylb/mtw-sequence/dist/tree/baseClasses"
import { SchemaConditionTag, SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { inherited?: boolean }
export type MapTreeCondition = SchemaConditionTag & { inherited?: boolean }

export type MapTreeItem = MapTreeExit | MapTreeRoom | MapTreeCondition

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

export type MapDispatchAction = MapDispatchSetTool | MapDispatchSetExitDrag

export type MapContextType = {
    mapId: string;
    tree: GenericTree<MapTreeItem>;
    UI: {
        //
        // The Map editor can conceivably need data for:
        //    - Which tool is selected in the toolbar
        //    - Whether an exit is being dragged, from where, and to where
        // Updates to this data should be performed through the mapDispatch
        // function.
        //
        toolSelected: ToolSelected;
        exitDrag: MapContextExitDrag;
    },
    // mapD3: MapDThree,
    mapDispatch: (action: MapDispatchAction) => void;
}
