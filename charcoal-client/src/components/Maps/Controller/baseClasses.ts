import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import MapDThree from "../Edit/MapDThree"
import { SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-base/ts/schema/components"
import { ComponentUUID, SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardExitFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/exit"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { shortName: GenericTree<SchemaOutputTag>, inherited?: boolean; }

export type MapTreeItem = MapTreeExit | MapTreeRoom
export const isMapTreeRoom = (node: MapTreeItem): node is MapTreeRoom => (node.tag === 'Room')
export const isMapTreeRoomWithPosition = (node: MapTreeItem): node is MapTreeRoom & { x: number; y: number } => (
    node.tag === 'Room' && (
        typeof node.x !== 'undefined' &&
        typeof node.y !== 'undefined'
    )
)

/**
 * MapExit wraps StandardExitFacet to add map-specific context
 * including the source room identifier for tracking exit origins
 */
export class MapExit {
    private _facet: StandardExitFacet
    private _from: `ROOM#${string}`

    constructor(exit: StandardExitFacet, from: `ROOM#${string}`) {
        this._facet = exit
        this._from = from
    }

    /**
     * Get the source room identifier
     */
    get from(): `ROOM#${string}` {
        return this._from
    }

    /**
     * Get the target room identifier
     */
    get to(): ComponentUUID | undefined {
        return this._facet.reference.universalKey
    }

    /**
     * Get the exit description if available
     */
    get description(): string | undefined {
        return this._facet.payload.toJSON() ?? undefined
    }

    /**
     * Create a new MapExit with updated from room
     */
    withFrom(from: `ROOM#${string}`): MapExit {
        return new MapExit(this._facet, from)
    }

    /**
     * Create a new MapExit with updated exit data
     */
    withExit(exit: StandardExitFacet): MapExit {
        return new MapExit(exit, this._from)
    }
}

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
    key: `ROOM#${string}`;
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
    roomId: `ROOM#${string}`;
    id: `ROOM#${string}`;
    x: number;
    y: number;
    shortName: string;
}

export type MapContextType = {
    mapId: `MAP#${string}`;
    standardForm: StandardForm;
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
