import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { GenericTree, GenericTreeNode, TreeId, treeNodeTypeguard  } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, MapTreeItem, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaExitTag, SchemaNameTag, SchemaOutputTag, SchemaPositionTag, SchemaRoomTag, SchemaTag, isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaExit, isSchemaMap, isSchemaName, isSchemaOutputTag, isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { stabilizeFactory } from "./stabilize"
import { addExitFactory } from "./addExit"
import { addRoomFactory } from "./addRoom"
import { useDispatch, useSelector } from "react-redux"
import { mapEditConditionsByMapId, toggle } from "../../../slices/UI/mapEdit"
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString"
import SchemaTagTree from "@tonylb/mtw-wml/dist/tagTree/schema"
import { selectKeysByTag } from "@tonylb/mtw-wml/dist/normalize/selectors/keysByTag"
import { genericIDFromTree, maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"
import { map } from "@tonylb/mtw-wml/dist/tree/map"
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"
import { StandardRoom, isStandardMap, isStandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { assertTypeguard } from "../../../lib/types"

const MapContext = React.createContext<MapContextType>({
    mapId: '',
    tree: [],
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: '', x: 0, y: 0 }
    },
    mapD3: new MapDThree({ tree: [], parentId: '', onAddExit: () => {}, onExitDrag: () => {} }),
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

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { schema, standardForm, updateSchema } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>(undefined)
    const dispatch = useDispatch()

    //
    // Create a GenericTree representation of the items relevant to the map
    //
    const mapComponent = useMemo(() => (assertTypeguard(standardForm.byId[mapId], isStandardMap)), [standardForm.byId, mapId])
    const [parentID, setParentID] = useState<string | undefined>(mapComponent.id)
    const tree = useMemo<GenericTree<SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag | SchemaPositionTag, TreeId>>(() => {
        const isMapContents = (item: SchemaTag): item is SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag | SchemaPositionTag => (
            isSchemaOutputTag(item) || isSchemaRoom(item) || isSchemaCondition(item) || isSchemaExit(item) || isSchemaName(item) || isSchemaPosition(item)
        )
        const positions = mapComponent?.positions ?? []
        const roomKeys = selectKeysByTag('Room')(positions)
        const roomAndExits = roomKeys
            .map((key) => (assertTypeguard(standardForm.byId[key], isStandardRoom)))
            .filter((roomComponent): roomComponent is StandardRoom => (Boolean(roomComponent)))
            .filter(({ exits }) => (exits.length > 0))
            .map(({ key, id, shortName, exits }) => ({ data: { tag: 'Room' as const, key }, id, children: [shortName, ...exits] }))
        const combinedTree = new SchemaTagTree([...positions, ...roomAndExits])
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
            .reorderedSiblings([['Room', 'Exit', 'Position'], ['If']])
            .tree
        return maybeGenericIDFromTree(treeTypeGuard({ tree: combinedTree, typeGuard: isMapContents }))
    }, [schema, standardForm.byId, mapComponent])

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
    const extractRoomsHelper = (parentId: string, contextRoomId?: string) => (previous: Partial<MapContextPosition>[], item: GenericTreeNode<SchemaTag, TreeId>): Partial<MapContextPosition>[] => {
        const { data, children, id } = item
        if (isSchemaRoom(data)) {
            const previousItem = previous.find(({ roomId }) => (roomId === data.key))
            const roomComponent = standardForm.byId[data.key]
            const name = (roomComponent && isStandardRoom(roomComponent)) ? schemaOutputToString(roomComponent.shortName.children) : data.key
            return children.reduce(extractRoomsHelper(parentId, data.key), [
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
                        id,
                        parentId,
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
                return findSelectedSubItem.children.reduce(extractRoomsHelper(findSelectedSubItem.id, contextRoomId), previous)
            }
        }
        return previous
    }
    const extractRoomsById = (incomingPositions: Record<string, { x: number; y: number }>) => (tree: GenericTree<SchemaTag, TreeId>): MapContextPosition[] => {
        const basePositions = tree.reduce<Partial<MapContextPosition>[]>(extractRoomsHelper(mapComponent.id), [])
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
    }
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(
        extractRoomsById({})(tree)
    )
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
    // TODO: Extract a MapTreeItem tree out of Schema (particularly, assigning names)
    //
    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            tree,
            parentId: mapComponent.id,
            onExitDrag: setExitDrag,
        })
    })
    const dispatchParentId = useMemo(() => (parentID ?? standardForm.byId[mapId]?.id), [parentID, mapId, standardForm.byId])
    const mapDispatch = useCallback((action: MapDispatchAction) => {
        switch(action.type) {
            case 'SetToolSelected':
                setToolSelected(action.value)
                return
            case 'UpdateTree':
                mapD3.update(action.tree, mapComponent.id)
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
                if (action.item && action.item.type === 'Layer') {
                    const ancestry = ancestryFromId(action.item.key)(schema) ?? []
                    const conditionParent = ancestry.find(treeNodeTypeguard((data): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))))
                    if (conditionParent) {
                        setParentID(conditionParent.id)
                    }
                    else {
                        setParentID(mapComponent.id)
                    }
                }
                setItemSelected(action.item)
                return
            case 'SelectParent':
                setParentID(action.item)
                return
            case 'AddRoom':
                addRoomFactory({ parentId: dispatchParentId, schema, updateSchema })({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'UnlockRoom':
                //
                // If roomId references a cascadeNode in that iterator, add it (at that location), otherwise no-op
                //
                const relevantMapDThreeIterator = mapD3.tree.layers.find(({ key }) => (key === dispatchParentId))
                if (relevantMapDThreeIterator) {
                    const relevantNode = relevantMapDThreeIterator.nodes.find(({ id }) => (id === action.roomId))
                    if (relevantNode && relevantNode.cascadeNode) {
                        addRoomFactory({ parentId: dispatchParentId, schema, updateSchema })({ roomId: relevantNode.roomId, x: relevantNode.fx, y: relevantNode.fy })
                    }
                }
                else {
                    const relevantContext = localPositions.find(({ id }) => (id === action.roomId))
                    if (relevantContext) {
                        addRoomFactory({ parentId: dispatchParentId, schema, updateSchema })({ roomId: relevantContext.roomId, x: relevantContext.x, y: relevantContext.y })
                    }
                }
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
    }, [mapD3, mapId, mapComponent.id, dispatchParentId, setToolSelected, setItemSelected, setCursorPosition, schema, updateSchema, dispatch])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ schema, updateSchema, parentId: dispatchParentId })
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
    }, [mapD3, mapId, onTick, schema, updateSchema, dispatchParentId])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', tree })
    }, [mapDispatch, tree])
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
                parentID,
                cursorPosition
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
            parentId: 'Root',
            onExitDrag: () => {},
            onTick
        })
    })
    useEffect(() => {
        mapD3.update(mappedTree, 'Root')
    }, [mapD3, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId: '',
            tree: mappedTree,
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
