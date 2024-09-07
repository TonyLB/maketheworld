import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { GenericTree, GenericTreeNode, TreeId, treeNodeTypeguard  } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, MapTreeItem, MapTreeSchemaTags, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import { SchemaAssetTag, SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaExitTag, SchemaNameTag, SchemaOutputTag, SchemaPositionTag, SchemaRoomTag, SchemaSelectedTag, SchemaTag, isSchemaAsset, isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaExit, isSchemaName, isSchemaOutputTag, isSchemaPosition, isSchemaRoom, isSchemaSelected, isSchemaShortName } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { addExitFactory } from "./addExit"
import { addRoomFactory } from "./addRoom"
import { useDispatch } from "react-redux"
import { toggle } from "../../../slices/UI/mapEdit"
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString"
import SchemaTagTree from "@tonylb/mtw-wml/dist/tagTree/schema"
import { selectKeysByTag } from "@tonylb/mtw-wml/dist/schema/selectors/keysByTag"
import { genericIDFromTree, maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"
import { map } from "@tonylb/mtw-wml/dist/tree/map"
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"
import { StandardForm, StandardRoom, isStandardMap, isStandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { assertTypeguard } from "../../../lib/types"
import { addImport } from "../../../slices/personalAssets"
import { addOnboardingComplete } from "../../../slices/player/index.api"
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils"
import { UpdateStandardPayloadReplaceItem } from "../../../slices/personalAssets/reducers"
import { Standardizer } from "@tonylb/mtw-wml/dist/standardize"

const MapContext = React.createContext<MapContextType>({
    mapId: '',
    nodeId: '',
    tree: [],
    selectedPositions: [],
    updateSelected: () => {},
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: '', x: 0, y: 0 }
    },
    mapD3: new MapDThree({ tree: [], standardForm: { key: '', tag: 'Asset', byId: {}, metaData: [] }, updateStandard: () => {}, mapId: '', onAddExit: () => {}, onExitDrag: () => {} }),
    mapDispatch: () => {},
    localPositions: []
})
export const useMapContext = () => (useContext(MapContext))

//
// ancestryFromId returns the nodes in the ancestry of a given tree node (identified by searchID), starting from the direct parent and
// proceeding up the tree.
//
const ancestryFromId = (searchID: string) => (tree: GenericTree<SchemaTag, TreeId>): GenericTreeNode<SchemaTag, TreeId>[] | undefined => {
    return tree.reduce<GenericTreeNode<SchemaTag, TreeId>[] | undefined>((previous, { data, id, children }) => {
        if (previous) {
            return previous
        }
        if (id === searchID) {
            return []
        }
        const recurse = ancestryFromId(searchID)(children)
        if (typeof recurse !== 'undefined') {
            return [...recurse, { data, id, children: [] }]
        }
        return previous
    }, undefined)
}

//
// ISS-4348: mapTreeMemo takes:
//    - A standard form
//    - The key of a map in that standardForm
//    - The replaceItem onChange for that standardForm
//
// ... and returns:
//    - A mapTree that lists all of the room, exit, and position information in a coherent way focussed on the map
//    - An onChange function that accepts changes to that mapTree
//
const mapTreeMemo = (standardForm: StandardForm, mapId: string, replaceItem: (args: Omit<UpdateStandardPayloadReplaceItem, 'type'>) => void): GenericTreeNode<SchemaAssetTag | SchemaExitTag | SchemaNameTag | SchemaRoomTag | SchemaPositionTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaOutputTag> => {
    const mapComponent = assertTypeguard(standardForm.byId[mapId], isStandardMap)
    const isMapContents = (item: SchemaTag): item is Exclude<MapTreeSchemaTags, SchemaAssetTag> => (
        isSchemaSelected(item) || isSchemaOutputTag(item) || isSchemaRoom(item) || isSchemaCondition(item) || isSchemaConditionStatement(item) || isSchemaConditionFallthrough(item) || isSchemaExit(item) || isSchemaName(item) || isSchemaPosition(item)
    )
    const filterRoomsWithChildren = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
        return tree.map(({ data, children, ...rest }) => (
            isSchemaRoom(data)
                ? (children.filter(({ data }) => (!isSchemaShortName(data))).length > 0
                    ? [{ data, ...rest, children: filterRoomsWithChildren(children) }]
                    : []
                )
                : [{ data, ...rest, children: filterRoomsWithChildren(children) }]
        )).flat(1)
    }

    const positions = mapComponent?.positions ?? []
    const roomKeys = selectKeysByTag('Room')(positions)
    const roomAndExits = roomKeys
        .map((key) => (assertTypeguard(standardForm.byId[key], isStandardRoom)))
        .filter((roomComponent): roomComponent is StandardRoom => (Boolean(roomComponent)))
        .map(({ key, shortName, exits }) => ({ data: { tag: 'Room' as const, key }, children: [shortName, ...exits] }))
    const combinedTree = new SchemaTagTree([
        ...positions,
        ...roomAndExits
    ])
        .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
        .reorderedSiblings([['Room', 'Exit', 'Position'], ['If']])
        .tree
    const tree: GenericTree<SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag | SchemaPositionTag, TreeId> = maybeGenericIDFromTree(treeTypeGuard({ tree: filterRoomsWithChildren(combinedTree), typeGuard: isMapContents }))
    return { data: { tag: 'Asset', key: standardForm.key, Story: undefined }, children: tree }
}

const firstSelectedSubTree = (tree: GenericTree<MapTreeSchemaTags>): GenericTree<MapTreeSchemaTags> | undefined => (
    tree.reduce<GenericTree<MapTreeSchemaTags> | undefined>((previous, { data , children }) => {
        if (previous) {
            return previous
        }
        if (isSchemaSelected(data)) {
            return children
        }
        return firstSelectedSubTree(children)
    }, undefined)
)

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { AssetId, standardForm, inheritedByAssetId, combinedStandardForm, updateStandard } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const dispatch = useDispatch()

    //
    // Create a GenericTree representation of the items relevant to the map
    //
    const mapComponent = useMemo(() => (assertTypeguard(standardForm.byId[mapId], isStandardMap)), [standardForm.byId, mapId])

    const replaceItem = useCallback((args: Omit<UpdateStandardPayloadReplaceItem, 'type'>) => {
        updateStandard({ ...args, type: 'replaceItem' })
    }, [updateStandard])
    const tree = useMemo(() => {
        return mapTreeMemo(standardForm, mapId, replaceItem).children
    }, [standardForm, mapId])
    const selectedPositions: GenericTree<MapTreeSchemaTags> = useMemo(() => (firstSelectedSubTree(tree) ?? tree), [tree])
    const updateSelected = () => {}

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
    const extractRoomsHelper = useCallback((parentId: string, context?: { roomId?: string, assetId?: string }) => (previous: Partial<MapContextPosition>[], item: GenericTreeNode<SchemaTag>): Partial<MapContextPosition>[] => {
        const { data, children } = item
        const { roomId: contextRoomId, assetId: contextAssetId } = context ?? {}
        if (isSchemaAsset(data)) {
            return children.reduce(extractRoomsHelper(parentId, { ...context, assetId: data.key }), previous)
        }
        if (isSchemaRoom(data)) {
            const previousItem = previous.find(({ roomId }) => (roomId === data.key))
            const roomComponent = combinedStandardForm.byId[data.key]
            const name = (roomComponent && isStandardRoom(roomComponent)) ? schemaOutputToString(ignoreWrapped(roomComponent.shortName)?.children ?? []) : data.key
            return children.reduce(extractRoomsHelper(parentId, { ...context, roomId: data.key }), [
                ...previous.filter(({ roomId }) => (roomId !== data.key)),
                {
                    ...previousItem,
                    roomId: data.key,
                    name
                }
            ])
        }
        if (isSchemaPosition(data) && contextRoomId) {
            const contextItem = previous.find(({ roomId }) => (roomId === contextRoomId))
            if (contextItem) {
                return [
                    ...previous.filter(({ roomId }) => (roomId !== contextRoomId)),
                    {
                        ...contextItem,
                        parentId: parentId ? parentId : contextAssetId ? `INHERITED#${contextAssetId}` : 'INHERITED',
                        x: data.x,
                        y: data.y
                    }
                ]
            }
        }
        if (isSchemaCondition(data)) {
            const findSelectedSubItem = children.filter(treeNodeTypeguard((data: SchemaTag): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))))
                .find(({ data }) => (data.selected))
            if (findSelectedSubItem) {
                return findSelectedSubItem.children.reduce(extractRoomsHelper(parentId, context), previous)
            }
        }
        return previous
    }, [combinedStandardForm.byId])
    const extractRoomsById = useCallback((incomingPositions: Record<string, { x: number; y: number }>) => (tree: GenericTree<SchemaTag>): MapContextPosition[] => {
        const basePositions = maybeGenericIDFromTree(tree)
            .reduce<Partial<MapContextPosition>[]>(
                extractRoomsHelper(''),
                []
            )
        const overwrittenPositions = basePositions.map(({ roomId, ...rest }) => (roomId in incomingPositions ? { roomId, ...rest, ...incomingPositions[roomId] }: { roomId, ...rest }))
        const valuesPresentTypeguard = (item: Partial<MapContextPosition>): item is MapContextPosition => (
            (typeof item.id !== 'undefined') &&
            (typeof item.parentId !== 'undefined') &&
            (typeof item.name !== 'undefined') &&
            (typeof item.roomId !== 'undefined') &&
            (typeof item.x !== 'undefined') &&
            (typeof item.y !== 'undefined')
        )
        return overwrittenPositions.filter(valuesPresentTypeguard)
    }, [extractRoomsHelper])
    const rawPositions = useMemo<MapContextPosition[]>(() => (extractRoomsById({})(tree)), [tree])
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(rawPositions)
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes
            .reduceRight<Record<string, { x: number; y: number}>>((previous, { roomId, x, y }) => (
                (typeof x !== 'undefined' && typeof y !== 'undefined')
                    ? { ...previous, [roomId]: { x: x ?? previous[roomId]?.x, y: y ?? previous[roomId]?.y }}
                    : previous
            ), {})

        const extractedPositions = extractRoomsById(xyByRoomId)(tree)
        return setLocalPositions(extractedPositions)
    }, [tree])

    //
    // Extract a MapTreeItem tree out of StandardForm
    //
    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            tree: maybeGenericIDFromTree(tree),
            standardForm,
            updateStandard,
            mapId,
            onExitDrag: setExitDrag,
        })
    })
    //
    // TODO: ISS-4368: Refactor mapController not to need parentIDs now that TreeId has been
    // deprecated
    //
    const dispatchParentId = useMemo(() => (''), [])
    const mapDispatch = useCallback((action: MapDispatchAction) => {
        switch(action.type) {
            case 'SetToolSelected':
                setToolSelected(action.value)
                return
            case 'UpdateTree':
                mapD3.update(action.tree, standardForm, updateStandard, mapId)
                return
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
            case 'SelectParent':
                return
            case 'AddRoom':
                addRoomFactory({ standard: standardForm, updateStandard, selectedPositions, updateSelected })({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'UnlockRoom':
                //
                // If roomId references a cascadeNode in that iterator, add it (at that location), otherwise no-op
                //
                const relevantMapDThreeIterator = mapD3.tree.layers.find(({ key }) => (key === dispatchParentId))
                if (relevantMapDThreeIterator) {
                    const relevantNode = relevantMapDThreeIterator.nodes.find(({ id }) => (id === action.roomId))
                    if (relevantNode && relevantNode.cascadeNode) {
                        addRoomFactory({ standard: standardForm, updateStandard, selectedPositions, updateSelected })({ roomId: relevantNode.roomId, x: relevantNode.fx, y: relevantNode.fy })
                    }
                }
                else {
                    const relevantContext = rawPositions.find(({ id }) => (id === action.roomId))
                    if (relevantContext) {
                        if (relevantContext.parentId.startsWith('INHERITED#')) {
                            const fromAsset = relevantContext.parentId.split('#')[1]
                            if (fromAsset) {
                                dispatch(addImport({ assetId: AssetId, fromAsset, type: 'Room', key: relevantContext.roomId }))
                            }
                        }
                        addRoomFactory({ standard: standardForm, updateStandard, selectedPositions, updateSelected })({ roomId: relevantContext.roomId, x: relevantContext.x, y: relevantContext.y })
                    }
                }
                return
            case 'ToggleVisibility':
                dispatch(toggle({ mapId, key: action.key }))
                return
        }
    }, [AssetId, mapD3, mapId, dispatchParentId, setToolSelected, setItemSelected, standardForm, updateStandard, dispatch, rawPositions])
    const addExitImport = useCallback((key: string) => {
        const relevantAssets = inheritedByAssetId.filter(({ standardForm }) => (key in standardForm.byId))
        if (relevantAssets.length) {
            dispatch(addImport({ assetId: AssetId, fromAsset: relevantAssets[0].assetId, type: 'Room', key }))
        }
    }, [inheritedByAssetId, dispatch])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ standardForm, combinedStandardForm, selectedPositions, updateSelected, addImport: addExitImport })
        const onAddExit = (fromRoomId, toRoomId, double) => {
            addExitFactoryOutput({ from: fromRoomId, to: toRoomId })
            if (double) {
                dispatch(addOnboardingComplete(['connectNewRoom']))
                addExitFactoryOutput({ from: toRoomId, to: fromRoomId })
            }
        }
        mapD3.setCallbacks({
            onTick: onTick,
            onStability: (value: SimNode[]) => {},
            onAddExit
        })
    }, [addExitImport, dispatch, mapD3, mapId, onTick, standardForm, combinedStandardForm, updateSelected])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', tree: maybeGenericIDFromTree(tree) })
    }, [mapDispatch, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId,
            nodeId: '',
            tree: maybeGenericIDFromTree(tree),
            selectedPositions,
            updateSelected: () => {},
            UI: {
                toolSelected,
                exitDrag,
                itemSelected
            },
            mapDispatch,
            mapD3,
            localPositions
        }}
    >
        { children }
    </MapContext.Provider>
}

export const MapDisplayController: FunctionComponent<{ tree: GenericTree<MapTreeItem, TreeId> }> = ({ tree, children }) => {
    //
    // Transform incoming tree of MapTreeItems back into a tree of SchemaTags
    //
    const mappedTree = useMemo(
        () => {
            const returnValue = map(tree, ({ data: { name, ...data }, children }): GenericTree<SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag> => ([
                {
                    data,
                    children: [
                        ...(data.tag === 'Room' ? [{ data: { tag: 'ShortName'  }, children: name }, { data: { tag: 'Position', x: data.x, y: data.y }, children: [] }] : []),
                        ...(data.tag === 'Exit' ? [{ data: { tag: 'Name'  }, children: [{ data: { tag: 'String', value: name }, children: [] }] }] : []),
                        ...children
                    ]
                }
            ]))
            return genericIDFromTree(returnValue)
        },
        [tree]
    )
    const standardForm = useMemo(
        () => {
            const standardizer = new Standardizer([{
                data: { tag: 'Asset', key: 'TEMP', Story: undefined },
                children: [{
                    data: { tag: 'Map', key: 'Map' },
                    children: mappedTree
                }]
            }])
            return standardizer.standardForm
        },
        [mappedTree]
    )
    //
    // Make local data and setters for node positions denormalized for display
    //
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(
        tree
            .map(({ data }) => (data))
            .filter(isMapTreeRoomWithPosition)
            .map(({ key, x, y, name  }) => ({ id: '', parentId: '', roomId: key, name: schemaOutputToString(name), x, y }))
    )
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        setLocalPositions(tree
            .map(({ data }) => (data))
            .filter(isMapTreeRoomWithPosition)
            .map((room) => ({
                id: '',
                parentId: '',
                roomId: room.key,
                x: 0,
                y: 0,
                key: room.key,
                ...(xyByRoomId[room.key] || {}),
                name: schemaOutputToString(room.name)
            }))
        )
    }, [tree])

    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            tree: mappedTree,
            standardForm,
            updateStandard: () => {},
            mapId: 'MAP',
            onExitDrag: () => {},
            onTick
        })
    })
    useEffect(() => {
        mapD3.update(mappedTree, standardForm, () => {}, 'Root')
    }, [mapD3, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId: '',
            nodeId: '',
            tree: mappedTree,
            selectedPositions: mappedTree,
            updateSelected: () => {},
            UI: {
                toolSelected: 'Select',
                exitDrag: { sourceRoomId: '', x: 0, y: 0 }
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
