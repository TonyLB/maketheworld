import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { isNormalExit, isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { GenericTree, GenericTreeNode  } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { mergeTrees } from '@tonylb/mtw-sequence/dist/tree/merge'
import { MapContextType, MapDispatchAction, MapTreeItem, ToolSelected } from "./baseClasses"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { SchemaConditionTag, SchemaRoomTag, isSchemaCondition, isSchemaExit, isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { deepEqual } from "../../../lib/objects"
import { unique } from "../../../lib/lists"
import MapDThree from "../Edit/MapDThree"
import { MapLayer, SimNode } from "../Edit/MapDThree/baseClasses"

//
// extractMapTree takes a standardized normalizer, and a mapId, and generates a generic tree of MapTreeItems
// representing the information needed to render the map in edit mode.
//
const extractMapTree = ({ normalizer, mapId }: { normalizer: Normalizer, mapId: string }): GenericTree<MapTreeItem> => {
    const mapItem = normalizer.normal[mapId]
    if (!mapItem || !isNormalMap(mapItem)) {
        return []
    }
    const wrapConditionals = (conditions: SchemaConditionTag[], item: GenericTreeNode<MapTreeItem>): GenericTreeNode<MapTreeItem> => {
        return conditions.reduceRight<GenericTreeNode<MapTreeItem>>((previous, condition) => ({
            data: condition,
            children: [previous]
        }), item)
    }
    const baseRoomTags: Record<string, SchemaRoomTag> = mapItem.appearances.reduce<string[]>(
        (previous, { rooms }) => (
            unique(
                previous,
                rooms.map(({ key }) => (key))
            )
        ), [])
        .reduce<Record<string, SchemaRoomTag>>((previous, key) => {
            const roomTag = normalizer.referenceToSchema({ key, tag: 'Room', index: 0 })
            if (!(roomTag && isSchemaRoom(roomTag))) {
                throw new Error('Room lookup failure')
            }
            return {
                ...previous,
                [key]: roomTag
            }
        }, {})
    const allRooms = mapItem.appearances.map<GenericTree<MapTreeItem>[]>(
        ({ rooms }) => (
            rooms
                .map(({ conditions, key }) => {
                    return [wrapConditionals(
                        conditions.length ? [{
                            tag: 'If',
                            conditions,
                            contents: [],
                        }]: [],
                        {
                            data: baseRoomTags[key],
                            children: []
                        }
                    )]
                })
        )
    ).flat(2)
    const allExits: GenericTree<MapTreeItem>[] = Object.values(normalizer.normal)
        .filter(isNormalExit)
        .filter(({ to, from }) => (to in baseRoomTags && from in baseRoomTags))
        .map<GenericTree<MapTreeItem>>((exitTag) => {
            return exitTag.appearances.map<GenericTreeNode<MapTreeItem>>(({ contextStack, name }) => {
                const conditions = contextStack
                    .filter(({ tag } ) => (tag === 'If'))
                    .map((reference) => {
                        const condition = normalizer.referenceToSchema(reference)
                        if (!(condition && isSchemaCondition(condition))) {
                            throw new Error('Condition lookup failure')
                        }
                        return condition
                    })
                return wrapConditionals(conditions, {
                    data: baseRoomTags[exitTag.from],
                    children: [{
                        data: { tag: 'Exit', key: exitTag.key, to: exitTag.to, from: exitTag.from, name, contents: [] },
                        children: []
                    }]
                })
            })
        })
    
    const mergeTreeOptions = {
        compare: (a: MapTreeItem, b: MapTreeItem) => (deepEqual(a, b)),
        extractProperties: (item: MapTreeItem): MapTreeItem | undefined => {
            return item
        },
        rehydrateProperties: (baseItem: MapTreeItem, properties: MapTreeItem[]) => (baseItem)
    }
    return mergeTrees(mergeTreeOptions)(
        allRooms.filter(({ data }) => (data.tag === 'Room')),
        allRooms.filter(({ data }) => (data.tag === 'If')),
        ...allExits
    )

}

const MapContext = React.createContext<MapContextType>({
    mapId: '',
    tree:[],
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: '', x: 0, y: 0 }
    },
    mapD3: new MapDThree({ roomLayers: [], exits: [], onAddExit: () => {}, onExitDrag: () => {} }),
    mapDispatch: () => {}
})
export const useMapContext = () => (useContext(MapContext))

//
// TODO: ISS3228: Create mapDispatch dispatch function for MapContext
//

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { normalForm } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')

    //
    // Generate a memo-fied standardizedNormalForm
    //
    const standardizedNormalizer = useMemo<Normalizer>(() => {
        const normalizer = new Normalizer()
        normalizer.loadNormal(normalForm)
        normalizer.standardize()
        return normalizer
    }, [normalForm])

    //
    // Create a GenericTree representation of the items relevant to the map
    //
    const tree = useMemo<GenericTree<MapTreeItem>>(() => (
        extractMapTree({ normalizer: standardizedNormalizer, mapId })
    ), [standardizedNormalizer, mapId])

    const temporaryTreeToLayersMapping = (tree: GenericTree<MapTreeItem>): { roomLayers: MapLayer[]; exits: { to: string; from: string; visible: boolean; }[] } => {
        return {
            roomLayers: [
                {
                    key: 'Default',
                    rooms: Object.assign(
                        {},
                        ...tree
                            .map(({ data }) => (data))
                            .filter(isSchemaRoom)
                            .map(({ key, x, y }) => ({ id: key, roomId: key, x: x ?? 0, y: y ?? 0 }))
                    ),
                    roomVisibility: {}
                },
                { key: 'Inherited', rooms: {}, roomVisibility: {} }
            ],
            exits: [],
        }
    }
    //
    // TODO: ISS3228: Create MVP naive mapD3 entry for MapContext
    //
    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            ...temporaryTreeToLayersMapping(tree),
            onExitDrag: (value) => { mapDispatch({ type: 'SetExitDrag', ...value })},
        })
    })
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])


    //
    // Make local data and setters for exit decorator source and drag location.
    //
    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })

    const mapDispatch = useCallback((action: MapDispatchAction) => {
        switch(action.type) {
            case 'SetToolSelected':
                setToolSelected(action.value)
                return
            case 'SetExitDrag':
                setExitDrag({
                    sourceRoomId: action.sourceRoomId ?? exitDrag.sourceRoomId,
                    x: action.x ?? exitDrag.x,
                    y: action.y ?? exitDrag.y
                })
                return
            case 'UpdateTree':
                //
                // TODO: ISS3228: Refactor mapD3 update to accept GenericTree<MapTreeItem>
                //
                mapD3.update(temporaryTreeToLayersMapping(action.tree))
                return
                // return returnVal({ ...state, ...treeToVisible(action.tree), tree: action.tree }, state.mapD3.nodes)
            case 'Tick':
                //
                // TODO: ISS3228: Figure out what information needs to be derived from mapD3 at updates
                // and ticks, to denormalize into MapContext
                //
                return
                // return returnVal(state, action.nodes)
            case 'SetCallbacks':
                mapD3.setCallbacks({ onTick: action.onTick, onStability: action.onStability })
                return
            // case 'SETNODE':
            //     state.mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
            //     return state
            // case 'ENDDRAG':
            //     state.mapD3.endDrag()
            //     return state
            // case 'DRAGEXIT':
            //     mapD3.dragExit({ roomId: action.roomId, x: action.x, y: action.y, double: action.double })
            //     return
        }
    }, [setToolSelected, exitDrag, setExitDrag, mapD3, temporaryTreeToLayersMapping])
    useEffect(() => {
        mapDispatch({
            type: 'SetCallbacks',
            onTick: (nodes: SimNode[]) => { mapDispatch({ type: 'Tick', nodes }) },
            onStability: (value: SimNode[]) => {
                // mapDispatch({ type: 'STABILIZE' })
                // onStabilize(value)
            }
        })
    }, [mapDispatch])

    //
    // TODO: ISS3228: Refactor MapArea items that depend upon mapD3 to pull from
    // MapContext
    //

    //
    // TODO: ISS3228: Lift MapArea reducer to MapController, and refactor to use more
    // sophisticated tree structure and more nuanced grouping of D3 Stack layers.
    //

    return <MapContext.Provider
        value={{
            mapId,
            tree,
            UI: {
                toolSelected,
                exitDrag
            },
            mapDispatch,
            mapD3
        }}
    >
        { children }
    </MapContext.Provider>
}

export default MapController
