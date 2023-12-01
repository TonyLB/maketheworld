import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react"
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
import { VisibleMapRoom } from "../Edit/maps"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"
import { stabilizeFactory } from "./stabilize"
import { addExitFactory } from "./addExit"

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
                .map(({ conditions, key, x, y }) => {
                    return [wrapConditionals(
                        conditions.length ? [{
                            tag: 'If',
                            conditions,
                            contents: [],
                        }]: [],
                        {
                            data: {
                                ...baseRoomTags[key],
                                x,
                                y
                            },
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
    mapDispatch: () => {},
    localPositions: []
})
export const useMapContext = () => (useContext(MapContext))

//
// TODO: ISS3228: Create mapDispatch dispatch function for MapContext
//

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { normalForm, updateNormal } = useLibraryAsset()
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

    const temporaryTreeToLayersMapping = useCallback((tree: GenericTree<MapTreeItem>): { roomLayers: MapLayer[]; exits: { to: string; from: string; visible: boolean; }[] } => {
        const returnValue = {
            roomLayers: [
                {
                    key: 'Default',
                    rooms: Object.assign(
                        {},
                        ...tree
                            .map(({ data }) => (data))
                            .filter(isSchemaRoom)
                            .filter(({ x, y }) => ((typeof x !== 'undefined') && (typeof y !== 'undefined')))
                            .map(({ key, x, y }) => ({ [key]: { id: key, roomId: key, x: x ?? 0, y: y ?? 0 } }))
                    ),
                    roomVisibility: {}
                },
                { key: 'Inherited', rooms: {}, roomVisibility: {} }
            ],
            exits: tree
                .filter(({ data }) => (isSchemaRoom(data)))
                .map(({ children }) => (
                    children.map(({ data }) => (data))
                        .filter(isSchemaExit)
                        .map(({ from, to }) => ({ from, to, visible: true }))
                )).flat(1)
        }
        return returnValue
    }, [])

    //
    // Make local data and setters for exit decorator source and drag location.
    //
    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })

    //
    // Make local data and setters for node positions denormalized for display
    //
    const [localPositions, setLocalPositions] = useState<VisibleMapRoom[]>(
        tree
            .map(({ data }) => (data))
            .filter(isSchemaRoom)
            .filter(({ x, y }) => ((typeof x !== 'undefined') && (typeof y !== 'undefined')))
            .map(({ key, x, y, name }) => ({ key, roomId: key, type: 'ROOM' as const, zLevel: 0, name: taggedMessageToString(name as any), x: x ?? 0, y: y ?? 0 }))
    )
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        //
        // TODO: Make room mapping more capable of parsing the whole tree, rather than just top-level rooms
        //
        return setLocalPositions(tree
                .map(({ data }) => (data))
                .filter(isSchemaRoom)
                .filter(({ x, y }) => ((typeof x !== 'undefined') && (typeof y !== 'undefined')))
                .map((room) => ({
                    type: 'ROOM' as const,
                    roomId: room.key,
                    x: 0,
                    y: 0,
                    key: room.key,
                    zLevel: 0,
                    name: taggedMessageToString(room.name as any),
                    ...(xyByRoomId[room.key] || {})
                }))
        )
    }, [tree])

    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            ...temporaryTreeToLayersMapping(tree),
            onExitDrag: setExitDrag,
        })
    })
    const mapDispatch = useCallback((action: MapDispatchAction) => {
        switch(action.type) {
            case 'SetToolSelected':
                setToolSelected(action.value)
                return
            case 'UpdateTree':
                //
                // TODO: ISS3228: Refactor mapD3 update to accept GenericTree<MapTreeItem>
                //
                mapD3.update(temporaryTreeToLayersMapping(action.tree))
                return
                // return returnVal({ ...state, ...treeToVisible(action.tree), tree: action.tree }, state.mapD3.nodes)
            case 'SetNode':
                mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'EndDrag':
                mapD3.endDrag()
                return
            case 'DragExit':
                mapD3.dragExit({ roomId: action.sourceRoomId, x: action.x, y: action.y, double: action.double })
                return
        }
    }, [mapD3, setToolSelected])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ normalForm, updateNormal })
        const onAddExit = (fromRoomId, toRoomId, double) => {
            addExitFactoryOutput({ from: fromRoomId, to: toRoomId })
            if (double) {
                addExitFactoryOutput({ from: toRoomId, to: fromRoomId })
            }
        }
        mapD3.setCallbacks({
            onTick: onTick,
            onStability: (value: SimNode[]) => {
                // mapDispatch({ type: 'STABILIZE' })
                stabilizeFactory({ mapId, normalForm, updateNormal })(value)
            },
            onAddExit
        })
    }, [mapD3, onTick, normalForm, updateNormal])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', tree })
    }, [mapDispatch, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

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
            mapD3,
            localPositions
        }}
    >
        { children }
    </MapContext.Provider>
}

export default MapController
