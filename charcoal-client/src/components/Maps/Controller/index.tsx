import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { GenericTree, GenericTreeNode, TreeId  } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, MapTreeItem, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import { SchemaConditionTag, SchemaExitTag, SchemaNameTag, SchemaOutputTag, SchemaPositionTag, SchemaRoomTag, SchemaTag, isSchemaCondition, isSchemaExit, isSchemaMap, isSchemaName, isSchemaOutputTag, isSchemaPosition, isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses"
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
        exitDrag: { sourceRoomId: '', x: 0, y: 0 },
        hiddenBranches: []
    },
    mapD3: new MapDThree({ tree: [], hiddenConditions: [], onAddExit: () => {}, onExitDrag: () => {} }),
    mapDispatch: () => {},
    localPositions: []
})
export const useMapContext = () => (useContext(MapContext))

export const MapController: FunctionComponent<{ mapId: string }> = ({ children, mapId }) => {
    const { schema, standardForm, updateSchema } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>(undefined)
    const mapConditionsSelector = useMemo(() => (mapEditConditionsByMapId(mapId)), [mapId])
    const hiddenBranches = useSelector(mapConditionsSelector)
    const dispatch = useDispatch()

    //
    // Create a GenericTree representation of the items relevant to the map
    //
    const tree = useMemo<GenericTree<SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag | SchemaPositionTag, TreeId>>(() => {
        const isMapContents = (item: SchemaTag): item is SchemaRoomTag | SchemaConditionTag | SchemaExitTag | SchemaNameTag | SchemaOutputTag | SchemaPositionTag => (
            isSchemaOutputTag(item) || isSchemaRoom(item) || isSchemaCondition(item) || isSchemaExit(item) || isSchemaName(item) || isSchemaPosition(item)
        )
        const mapComponent = assertTypeguard(standardForm.byId[mapId], isStandardMap)
        const positions = mapComponent?.positions ?? []
        const roomKeys = selectKeysByTag('Room')(positions)
        const roomAndExits = roomKeys
            .map((key) => (assertTypeguard(standardForm.byId[key], isStandardRoom)))
            .filter((roomComponent): roomComponent is StandardRoom => (Boolean(roomComponent)))
            .map(({ key, id, shortName, exits }) => ({ data: { tag: 'Room' as const, key }, id, children: [shortName, ...exits] }))
        const combinedTree = new SchemaTagTree([...positions, ...roomAndExits]).tree
        return maybeGenericIDFromTree(treeTypeGuard({ tree: combinedTree, typeGuard: isMapContents }))
    }, [schema, mapId])

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
    const extractRoomsHelper = (contextRoomId?: string) => (previous: Partial<MapContextPosition>[], item: GenericTreeNode<SchemaTag, TreeId>): Partial<MapContextPosition>[] => {
        const { data, children, id } = item
        if (isSchemaRoom(data)) {
            const previousItem = previous.find(({ roomId }) => (roomId === data.key))
            const roomComponent = standardForm.byId[data.key]
            const name = (roomComponent && isStandardRoom(roomComponent)) ? schemaOutputToString(roomComponent.shortName.children) : data.key
            return children.reduce(extractRoomsHelper(data.key), [
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
                        x: data.x,
                        y: data.y
                    }
                ]
            }
        }
        return previous
    }
    const extractRoomsById = (incomingPositions: Record<string, { x: number; y: number }>) => (tree: GenericTree<SchemaTag, TreeId>): MapContextPosition[] => {
        const basePositions = tree.reduce<Partial<MapContextPosition>[]>(extractRoomsHelper(), [])
        const overwrittenPositions = basePositions.map(({ roomId, ...rest }) => (roomId in incomingPositions ? { roomId, ...rest, ...incomingPositions[roomId] }: { roomId, ...rest }))
        const valuesPresentTypeguard = (item: Partial<MapContextPosition>): item is MapContextPosition => (
            (typeof item.id !== 'undefined') &&
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
            .reduce<Record<string, { x: number; y: number}>>((previous, { roomId, x, y }) => (
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
                mapD3.update(action.tree, action.hiddenConditions)
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
            .map(({ key, x, y, name  }) => ({ id: '', roomId: key, name: schemaOutputToString(name), x, y }))
    )
    const onTick = useCallback((nodes: SimNode[]) => {
        const xyByRoomId = nodes.reduce<Record<string, { x?: number; y?: number}>>((previous, { roomId, x, y }) => ({ ...previous, [roomId]: { x: x || 0, y: y || 0 }}), {})
        setLocalPositions(tree
            .map(({ data }) => (data))
            .filter(isMapTreeRoomWithPosition)
            .map((room) => ({
                id: '',
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
            hiddenConditions: [],
            onExitDrag: () => {},
            onTick
        })
    })
    useEffect(() => {
        mapD3.update(mappedTree, [])
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
