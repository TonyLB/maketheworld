import React, { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLibraryAsset } from "../../Library/Edit/LibraryAsset"

import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { addExitFactory } from "./addExit"
import { addRoomFactory } from "./addRoom"
import { useDispatch } from "react-redux"

import { addImport } from "../../../slices/personalAssets"
import { addOnboardingComplete } from "../../../slices/player/index.api"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardRoom, { StandardRoomPayload } from "@tonylb/mtw-wml/ts/standardize/components/room"
import { isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"

import { StandardKey } from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { excludeUndefined } from "../../../lib/lists"
import StandardPosition, { StandardPositionSimple, StandardPositionSimpleBase } from "@tonylb/mtw-wml/ts/standardize/components/position"
import { StandardExitPlain } from "@tonylb/mtw-wml/ts/standardize/components/exit"
import { extractExitsFromStandardForm } from "../exitExtraction"

export const MapContext = React.createContext<MapContextType>({
    mapId: 'MAP#default',
    UI: {
        toolSelected: 'Select',
        exitDrag: { sourceRoomId: 'ROOM#', x: 0, y: 0 }
    },
    mapD3: {} as MapDThree, // Placeholder - will be properly initialized in MapController
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
        cascadeConditions: [{
            graph: [
                { name: 'map', requestType: 'Full', transitions: [
                    { connectionType: 'Position', targetNode: 'room' }
                ] },
                { name: 'room', requestType: 'ExitsAndShortName', transitions: [
                    { connectionType: 'Exit', targetNode: 'exitTarget' }
                ] },
                { name: 'exitTarget', requestType: 'ShortName', transitions: [] }
            ],
            startNodes: ['map']
        }]
    }])
    mapSubset._key = 'mapTree'
    
    // Filter each room's exits to only include those whose target rooms exist in the subset
    mapSubset._components.forEach((component) => {
        if (component instanceof StandardRoom && component._payload instanceof StandardRoomPayload) {
            // Filter the room's exits to only include those where target rooms exist in the map subset
            component._payload._exits = component.exits.filter((exit) => {
                if (!(exit instanceof StandardExitPlain)) return false
                
                const targetRoom = exit.payload?.to
                if (!targetRoom) return false
                
                // Check if the target room exists in the map subset
                return Boolean(mapSubset._lookup(targetRoom))
            })
        }
    })
    
    return mapSubset
}

const localPositionsFromStandardForms = ({ inherited, local, mapId }: { inherited?: StandardForm; local: StandardForm, mapId: `MAP#${string}` }): MapContextPosition[] => {
    const localPositionsFromSingleStandardForm = (standardForm: StandardForm): MapContextPosition[] => {
        const mapComponent = standardForm.byUniversalId[mapId]
        if (mapComponent && mapComponent instanceof StandardMap) {
            return mapComponent.positions.map((position) => {
                const roomComponent = standardForm._lookup(position.room._payload.plain.standardKey.toJSON())
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
    const { AssetId, localStandardForm, inheritedStandardForm, standardForm, updateStandard } = useLibraryAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const dispatch = useDispatch()

    //
    // Create a StandardForm representation of the items relevant to the map
    //
    const editable: StandardForm = useMemo(() => (mapTreeMemo(localStandardForm, mapId)), [localStandardForm, mapId])
    const inherited: StandardForm = useMemo(() => (mapTreeMemo(new StandardForm(inheritedStandardForm), mapId)), [inheritedStandardForm, mapId])

    //
    // Make local data and setters for exit decorator source and drag location.
    //
    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: `ROOM#${string}`; x: number; y: number }>({ sourceRoomId: 'ROOM#', x: 0, y: 0 })

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

    const onTick = useCallback((nodes: SimNode[]) => {
        setLocalPositions(nodes.map(({ id, x, y }) => {
            const roomComponent = editable.byUniversalId[id]
            if (roomComponent && roomComponent instanceof StandardRoom) {
                return {
                    name: roomComponent.shortName?._payload.plain.toJSON() ?? '',
                    position: new StandardPosition(new StandardPositionSimple({ room: id, x, y }))
                }
            }
            else {
                return {
                    name: '',
                    position: new StandardPosition(new StandardPositionSimple({ room: id, x, y }))
                }
            }
        }))
    }, [setLocalPositions, editable])

    const onStability = useCallback((nodes: SimNode[]) => {
        const update = (standard: StandardForm) => {
            const draft = standard._clone()
            const mapComponent = draft.byUniversalId[mapId]
            if (mapComponent && mapComponent instanceof StandardMap) {
                nodes.forEach(({ id, x, y }) => {
                    const position = mapComponent.positions.find((position) => (position.room.universalKey === id))
                    const payload = position?._payload
                    if (payload && payload instanceof StandardPositionSimpleBase) {
                        payload.x = x
                        payload.y = y
                    }
                })
            }
            return draft
        }
        updateStandard({ type: 'update', update })
    }, [mapId, updateStandard])

    const dispatchParentId = useMemo(() => (''), [])

    const maybeAddImport = useCallback((roomId: `ROOM#${string}`): 'local' | 'added' | 'notFound' => {
        const localAsset = editable.byUniversalId[roomId]
        if (localAsset) {
            return 'local'
        }
        const inheritedAsset = inherited.byUniversalId[roomId]
        if (inheritedAsset) {
            const originAssetId = (inheritedAsset.origin ?? []).slice(-1)[0]
            if (originAssetId) {
                dispatch(addImport({ assetId: AssetId, fromAsset: originAssetId, tag: 'Room', uuid: roomId }))
                return 'added'
            }
        }
        return 'notFound'
    }, [inherited, dispatch])

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
                addRoomFactory({ mapId, standard: editable, updateStandard })({ roomId: action.roomId, x: action.x, y: action.y })
                return
            case 'UnlockRoom':
                //
                // Look up the origin asset of the roomId in the inheritedStandardForm
                //
                const unlockRoomId = action.roomId
                if (unlockRoomId && isSchemaComponentUUID(unlockRoomId) && unlockRoomId.startsWith('ROOM#')) {
                    if (maybeAddImport(unlockRoomId as `ROOM#${string}`) === 'added') {
                        addRoomFactory({ mapId, standard: editable, updateStandard })({ roomId: unlockRoomId as `ROOM#${string}` })
                    }
                }
                return

        }
    }, [AssetId, mapD3, mapId, dispatchParentId, setToolSelected, setItemSelected, editable, updateStandard, dispatch])
    useEffect(() => {
        const addExitFactoryOutput = addExitFactory({ standardForm, editable, addImport: maybeAddImport, updateStandard })
        const onAddExit = (fromRoomId: `ROOM#${string}`, toRoomId: `ROOM#${string}`, double: boolean) => {
            addExitFactoryOutput({ from: fromRoomId, to: toRoomId })
            if (double) {
                dispatch(addOnboardingComplete(['connectNewRoom']))
                addExitFactoryOutput({ from: toRoomId, to: fromRoomId })
            }
        }
        mapD3.setCallbacks({ onTick, onStability, onAddExit })
    }, [mapD3, dispatch, mapId, standardForm, editable, updateStandard, onTick, onStability])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', inherited, editable })
    }, [mapDispatch, inherited, editable])
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
        setLocalPositions(nodes.map(({ id, x, y }) => {
            const roomComponent = standardForm.byUniversalId[id]
            if (roomComponent && roomComponent instanceof StandardRoom) {
                return {
                    name: roomComponent.shortName?._payload.plain.toJSON() ?? '',
                    position: new StandardPosition(new StandardPositionSimple({ room: id, x, y }))
                }
            }
            else {
                return {
                    name: '',
                    position: new StandardPosition(new StandardPositionSimple({ room: id, x, y }))
                }
            }
        }))
    }, [setLocalPositions, standardForm])


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
                exitDrag: { sourceRoomId: 'ROOM#', x: 0, y: 0 }
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
