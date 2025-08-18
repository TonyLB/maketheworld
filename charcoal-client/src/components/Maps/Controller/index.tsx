import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"
import { GenericTree, GenericTreeNode, treeNodeTypeguard  } from '@tonylb/mtw-base/ts/genericTree'
import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, MapTreeItem, MapTreeSchemaTags, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { addExitFactory } from "./addExit"
import { addRoomFactory } from "./addRoom"
import { useDispatch } from "react-redux"
import { toggle } from "../../../slices/UI/mapEdit"
import { schemaOutputToString } from "@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString"
import { map } from "@tonylb/mtw-wml/ts/tree/map"
import { addImport } from "../../../slices/personalAssets"
import { addOnboardingComplete } from "../../../slices/player/index.api"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardRoom, { StandardRoomPayload } from "@tonylb/mtw-wml/ts/standardize/components/room"
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-base/ts/schema/components"
import { SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaSelected, SchemaConditionTag } from "@tonylb/mtw-base/ts/schema/condition"
import { StandardKey } from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { excludeUndefined } from "../../../lib/lists"

const MapContext = React.createContext<MapContextType>({
    mapId: 'MAP#',
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: '', x: 0, y: 0 }
    },
    mapD3: new MapDThree({ inherited: new StandardForm('inherited'), editable: new StandardForm('editable'), updateStandard: () => {}, mapId: 'MAP#', onAddExit: () => {}, onExitDrag: () => {} }),
    mapDispatch: () => {},
    localPositions: []
})
export const useMapContext = () => (useContext(MapContext))

//
// mapTreeMemo takes:
//    - A standard form
//    - The universal key of a map in that standardForm
//
// ... and returns the subset of the standardForm that is relevant to that map
//
export const mapTreeMemo = (standardForm: StandardForm, mapId: `MAP#${string}`): StandardForm => {
    const mapSubset = standardForm.subset([{
        requestType: 'Full',
        keys: [new StandardKey(mapId)],
        cascadeConditions: [{ conditionType: 'Position', cascadeType: 'Exit' }]
    }])
    mapSubset._key = 'mapTree'
    mapSubset._components.forEach((component) => {
        if (component instanceof StandardRoom && component._payload instanceof StandardRoomPayload) {
            component._payload._exits = component.exits.filter((exit) => (
                Boolean(mapSubset._lookup(exit._payload.plain.to))
            ))
        }
    })
    return mapSubset
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

const localPositionsFromStandardForms = ({ inherited, local, mapId }: { inherited?: StandardForm; local: StandardForm, mapId: `MAP#${string}` }): MapContextPosition[] => {
    const localPositionsFromSingleStandardForm = (standardForm: StandardForm): MapContextPosition[] => {
        const mapComponent = standardForm.byUniversalId[mapId]
        if (mapComponent && mapComponent instanceof StandardMap) {
            return mapComponent.positions.map((position) => {
                const roomComponent = standardForm._lookup(position.room._payload.plain.toJSON())
                if (roomComponent && roomComponent instanceof StandardRoom) {
                    return {
                        name: roomComponent.shortName?._payload.plain.toJSON() ?? '',
                        position: position.clone()
                    }
                }
                return undefined
            }).filter(excludeUndefined)
        }
        return []
    }
    return [...(inherited ? localPositionsFromSingleStandardForm(inherited) : []), ...localPositionsFromSingleStandardForm(local)]
}

export const MapController: FunctionComponent<{ mapId: `MAP#${string}` }> = ({ children, mapId }) => {
    const { AssetId, localStandardForm, inheritedStandardForm, updateStandard } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const dispatch = useDispatch()

    //
    // Create a StandardForm representation of the items relevant to the map
    //
    const editable: StandardForm = useMemo(() => {
        return mapTreeMemo(localStandardForm, mapId)
    }, [localStandardForm, mapId])
    const inherited: StandardForm = useMemo(() => (mapTreeMemo(new StandardForm(inheritedStandardForm), mapId)), [inheritedStandardForm, mapId])

    //
    // Make local data and setters for exit decorator source and drag location.
    //
    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })

    //
    // Extract a MapTreeItem tree out of StandardForm
    //
    const [mapD3] = useState<MapDThree>(() => {
        return new MapDThree({
            inherited,
            editable,
            updateStandard,
            mapId,
            onExitDrag: setExitDrag,
        })
    })
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(localPositionsFromStandardForms({ inherited, local: editable, mapId }))

    const dispatchParentId = useMemo(() => (''), [])
    const mapDispatch = useCallback((action: MapDispatchAction) => {
        switch(action.type) {
            case 'SetToolSelected':
                setToolSelected(action.value)
                return
            case 'UpdateTree':
                mapD3.update(inherited, editable, updateStandard, mapId)
                return
            case 'SetNode':
                mapD3.dragNode({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'EndDrag':
                mapD3.endDrag()
                return
            case 'DragExit':
                mapD3.dragExit({ roomId: action.sourceRoomId, x: action.x, y: action.y, double: action.double ?? false })
                return
            case 'SelectItem':
                setItemSelected(action.item)
                return
            case 'SelectParent':
                return
            case 'AddRoom':
                addRoomFactory({ standard: standardForm.toJSON(), updateStandard, selectedPositions, updateSelected })({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'UnlockRoom':
                //
                // If roomId references a cascadeNode in that iterator, add it (at that location), otherwise no-op
                //
                const relevantMapDThreeIterator = mapD3.tree.layers.find(({ key }) => (key === dispatchParentId))
                if (relevantMapDThreeIterator) {
                    const relevantNode = relevantMapDThreeIterator.nodes.find(({ id }) => (id === action.roomId))
                    if (relevantNode && relevantNode.cascadeNode) {
                        addRoomFactory({ standard: standardForm.toJSON(), updateStandard, selectedPositions, updateSelected })({ roomId: relevantNode.roomId, x: relevantNode.fx === null ? undefined : relevantNode.fx, y: relevantNode.fy === null ? undefined : relevantNode.fy })
                    }
                }
                else {
                    const relevantContext = rawPositions.find(({ id }) => (id === action.roomId))
                    if (relevantContext) {
                        if (relevantContext.parentId.startsWith('INHERITED#')) {
                            const fromAsset = relevantContext.parentId.split('#')[1]
                            if (fromAsset) {
                                dispatch(addImport({ assetId: AssetId, fromAsset, tag: 'Room', key: relevantContext.roomId }))
                            }
                        }
                        addRoomFactory({ standard: standardForm.toJSON(), updateStandard, selectedPositions, updateSelected })({ roomId: relevantContext.roomId, x: relevantContext.x, y: relevantContext.y })
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
            dispatch(addImport({ assetId: AssetId, fromAsset: relevantAssets[0].assetId, tag: 'Room', key }))
        }
    }, [inheritedByAssetId, dispatch])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ standardForm: standardForm.toJSON(), selectedPositions, updateSelected, addImport: addExitImport })
        const onAddExit = (fromRoomId: string, toRoomId: string, double: boolean) => {
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
    }, [addExitImport, dispatch, mapD3, mapId, onTick, standardForm, updateSelected])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', tree })
    }, [mapDispatch, tree])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId,
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

export const MapDisplayController: FunctionComponent<{ standardForm: StandardForm, mapId: `MAP#${string}` }> = ({ standardForm, mapId, children }) => {

    //
    // Make local data and setters for node positions denormalized for display
    //
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(localPositionsFromStandardForms({ local: standardForm, mapId }))
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
            inherited: new StandardForm('inherited'),
            editable: standardForm,
            updateStandard: () => {},
            mapId,
            onExitDrag: () => {},
            onTick
        })
    })
    useEffect(() => {
        mapD3.update(new StandardForm('inherited'), standardForm, () => {}, mapId)
    }, [mapD3, standardForm, mapId])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId,
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
