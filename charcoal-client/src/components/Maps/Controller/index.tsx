import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { BaseAppearance, ComponentAppearance, NormalCondition, NormalReference, isNormalExit, isNormalMap } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { GenericTree, GenericTreeNode  } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { mergeTrees } from '@tonylb/mtw-wml/dist/sequence/tree/merge'
import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, MapTreeItem, MapTreeRoom, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import Normalizer from "@tonylb/mtw-wml/dist/normalize"
import { SchemaConditionTag, SchemaRoomTag, isSchemaCondition, isSchemaRoom } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import { deepEqual } from "../../../lib/objects"
import { unique } from "../../../lib/lists"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"
import { stabilizeFactory } from "./stabilize"
import { addExitFactory } from "./addExit"
import { addRoomFactory } from "./addRoom"
import { useDispatch, useSelector } from "react-redux"
import { mapEditConditionsByMapId, toggle } from "../../../slices/UI/mapEdit"
import dfsWalk from "@tonylb/mtw-wml/dist/sequence/tree/dfsWalk"

//
// extractMapTree takes a standardized normalizer, and a mapId, and generates a generic tree of MapTreeItems
// representing the information needed to render the map in edit mode.
//
const extractMapTreeHelper = (references: NormalReference[], options: { normalizer: Normalizer; baseRoomTags: Record<string, SchemaRoomTag> }): GenericTree<MapTreeItem> => {
    const { baseRoomTags = {}, normalizer } = options
    return references.map((reference) => {        
        if (reference.tag === 'Room') {
            const node = normalizer.normal[reference.key].appearances[reference.index] as ComponentAppearance
            return [{
                data: {
                    ...baseRoomTags[reference.key],
                    x: node.x,
                    y: node.y,
                    reference,
                    contents: []
                },
                children: []
            }]
        }
        if (reference.tag === 'If') {
            const baseNode = normalizer.normal[reference.key] as NormalCondition
            const node = baseNode.appearances[reference.index] as BaseAppearance            
            return [{
                data: {
                    tag: 'If' as const,
                    key: baseNode.key,
                    conditions: baseNode.conditions,
                    contents: []
                },
                children: extractMapTreeHelper(node.contents, { normalizer, baseRoomTags })
            }]
        }
        return []
    }).flat(1)
}

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
    //
    // TODO: ISS-3272: Refactor this section here to use the contents of each appearance,
    // rather than the rooms denormalization
    //
    const allRooms = mapItem.appearances.map<GenericTree<MapTreeItem>>(
        ({ contents }) => (extractMapTreeHelper(contents, { normalizer, baseRoomTags }))
    ).flat(1)
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
                    data: {
                        ...baseRoomTags[exitTag.from],
                        reference: { key: exitTag.from, tag: 'Room', index: 0 }
                    },
                    children: [{
                        data: { tag: 'Exit', key: exitTag.key, to: exitTag.to, from: exitTag.from, name, contents: [] },
                        children: []
                    }]
                })
            })
        })
    
    const mergeTreeOptions = {
        compare: (a: MapTreeItem, b: MapTreeItem) => {
            if (a.tag === 'Room' && b.tag === 'Room') {
                return deepEqual(
                    { ...a, x: 0, y: 0, reference: undefined, contents: [], render: [], name: [] },
                    { ...b, x: 0, y: 0, reference: undefined, contents: [], render: [], name: [] }
                )
            }
            return deepEqual(a, b)
        },
        extractProperties: (item: MapTreeItem): MapTreeItem | undefined => {
            return item
        },
        rehydrateProperties: (baseItem: MapTreeItem, properties: MapTreeItem[]) => (
            baseItem.tag === 'Room'
                ? properties.filter((value): value is MapTreeRoom => (value.tag === 'Room')).reduce((previous, { x, y, reference }) => (
                    (typeof x !== 'undefined' && typeof y !== 'undefined')
                        ? { ...previous, x, y, reference }
                        : previous
                ), baseItem)
                : baseItem
        )
    }
    return mergeTrees(mergeTreeOptions)(
        allRooms.filter(({ data }) => (data.tag === 'Room')),
        ...allExits,
        allRooms.filter(({ data }) => (data.tag === 'If'))
    )

}

const MapContext = React.createContext<MapContextType>({
    mapId: '',
    tree: [],
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: '', x: 0, y: 0 },
        hiddenBranches: []
    },
    mapD3: new MapDThree({ tree: [], hiddenConditions: [], onAddExit: () => {}, onExitDrag: () => {} }),
    mapDispatch: () => {},
    localPositions: []
})
export const useMapContext = () => (useContext(MapContext))

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { normalForm, updateNormal, schema, updateSchema } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>(undefined)
    const mapConditionsSelector = useMemo(() => (mapEditConditionsByMapId(mapId)), [mapId])
    const hiddenBranches = useSelector(mapConditionsSelector)
    const dispatch = useDispatch()

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

    //
    // Make local data and setters for exit decorator source and drag location.
    //
    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })

    //
    // TODO: Align localPositions derivation and setting with MapD3 understanding of the whole tree.
    //

    //
    // Make local data and setters for node positions denormalized for display
    //
    const extractRoomsByIdWalk = (incomingPositions: Record<string, { x: number; y: number }>) => (previous: { output: MapContextPosition[]; state: {} }, item: MapTreeItem): { output: MapContextPosition[]; state: {} } => {
        if (item.tag === 'Room' && item.reference) {
            if (item.key in incomingPositions) {
                return {
                    ...previous,
                    output: [
                        ...previous.output.filter(({ roomId }) => (roomId !== item.key)),
                        {
                            roomId: item.key,
                            name: taggedMessageToString(item.name as any),
                            x: incomingPositions[item.key]?.x,
                            y: incomingPositions[item.key]?.y,
                            reference: item.reference
                        }
                    ]
                }
            }
            return previous
        }
        return previous
    }
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(
        dfsWalk({ callback: extractRoomsByIdWalk({}), default: { output: [], state: {} } })(tree)
    )
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes
            .reduce<Record<string, { x: number; y: number}>>((previous, { roomId, x, y }) => (
                (typeof x !== 'undefined' && typeof y !== 'undefined')
                    ? { ...previous, [roomId]: { x: x ?? previous[roomId]?.x, y: y ?? previous[roomId]?.y }}
                    : previous
            ), {})

        const walkedPositions = dfsWalk({ callback: extractRoomsByIdWalk(xyByRoomId), default: { output: [], state: {} } })(tree)
        return setLocalPositions(walkedPositions)
    }, [tree])

    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            tree,
            hiddenConditions: hiddenBranches,
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
                mapD3.update(action.tree, action.hiddenConditions)
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
            case 'SelectItem':
                setItemSelected(action.item)
                return
            case 'AddRoom':
                addRoomFactory({ mapId, schema, updateSchema })({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'SetCursor':
                if ((typeof action.x !== 'undefined') || (typeof action.y !== 'undefined')) {
                    setCursorPosition({ x: action.x, y: action.y })
                }
                else {
                    setCursorPosition(undefined)
                }
                return
            case 'ToggleVisibility':
                dispatch(toggle({ mapId, key: action.key }))
                return
        }
    }, [mapD3, mapId, setToolSelected, setItemSelected, setCursorPosition, schema, updateSchema, dispatch])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ schema, updateSchema })
        const onAddExit = (fromRoomId, toRoomId, double) => {
            addExitFactoryOutput({ from: fromRoomId, to: toRoomId })
            if (double) {
                addExitFactoryOutput({ from: toRoomId, to: fromRoomId })
            }
        }
        mapD3.setCallbacks({
            onTick: onTick,
            onStability: (value: SimNode[]) => {
                stabilizeFactory({ schema, updateSchema })(value)
            },
            onAddExit
        })
    }, [mapD3, mapId, onTick, schema, updateSchema])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', tree, hiddenConditions: hiddenBranches })
    }, [mapDispatch, tree, hiddenBranches])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId,
            tree,
            UI: {
                toolSelected,
                exitDrag,
                itemSelected,
                cursorPosition,
                hiddenBranches
            },
            mapDispatch,
            mapD3,
            localPositions
        }}
    >
        { children }
    </MapContext.Provider>
}

export const MapDisplayController: FunctionComponent<{ tree: GenericTree<MapTreeItem> }> = ({ tree, children }) => {
    //
    // Make local data and setters for node positions denormalized for display
    //
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(
        tree
            .map(({ data }) => (data))
            .filter(isMapTreeRoomWithPosition)
            .map(({ key, x, y, name, reference }) => ({ roomId: key, name: taggedMessageToString(name as any), x, y, reference }))
    )
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        return setLocalPositions(tree
                .map(({ data }) => (data))
                .filter(isMapTreeRoomWithPosition)
                .map((room) => ({
                    roomId: room.key,
                    x: 0,
                    y: 0,
                    key: room.key,
                    name: taggedMessageToString(room.name as any),
                    reference: room.reference,
                    ...(xyByRoomId[room.key] || {})
                }))
        )
    }, [tree])

    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            tree,
            hiddenConditions: [],
            onExitDrag: () => {},
            onTick
        })
    })
    useEffect(() => {
        mapD3.update(tree, [])
    }, [mapD3, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId: '',
            tree,
            UI: {
                toolSelected: 'Select',
                exitDrag: { sourceRoomId: '', x: 0, y: 0 },
                hiddenBranches: []
            },
            mapDispatch: () => {},
            mapD3,
            localPositions
        }}
    >
        { children }
    </MapContext.Provider>
}

export default MapController
