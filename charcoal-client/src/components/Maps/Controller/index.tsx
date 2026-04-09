import React, { FunctionComponent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { MapContextItemSelected, MapContextPosition, MapContextType, MapDispatchAction, ToolSelected, isMapTreeRoomWithPosition } from "./baseClasses"
import MapDThree from "../Edit/MapDThree"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardRoom, { StandardRoomPayload } from "@tonylb/mtw-wml/ts/standardize/components/room"

import { StandardKey } from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { excludeUndefined } from "../../../lib/lists"
import { PositionRemoveClass } from "@tonylb/mtw-wml/ts/standardize/keys/facets/position"
import { ExitFacetList } from "@tonylb/mtw-wml/ts/standardize/keys/facets/exit"

const emptyStandardForm = new StandardForm('<Asset uuid=(default) />')
export const MapContext = React.createContext<MapContextType>({
    mapId: 'MAP#default',
    standardForm: emptyStandardForm,
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
    // Note: _key property doesn't exist on StandardForm - removed
    
    // Filter each room's exits to only include those whose target rooms exist in the subset
    mapSubset._components.forEach((component) => {
        if (component instanceof StandardRoom && component._payload instanceof StandardRoomPayload) {
            // Filter the room's exits to only include those where target rooms exist in the map subset
            const filteredExits = component.exits.items.filter((exitFacet) => {
                // Exit facets always have a reference - check if target room exists
                const targetRoom = exitFacet.reference.universalKey
                if (!targetRoom) return false
                
                // Check if the target room exists in the map subset
                return Boolean(mapSubset._lookup(targetRoom))
            })
            component._payload._exits = new ExitFacetList(filteredExits)
        }
    })
    
    return mapSubset
}

const localPositionsFromStandardForms = ({ inherited, local, mapId }: { inherited?: StandardForm; local: StandardForm, mapId: `MAP#${string}` }): MapContextPosition[] => {
    const localPositionsFromSingleStandardForm = (standardForm: StandardForm): MapContextPosition[] => {
        const mapComponent = standardForm.byUniversalId[mapId]
        if (mapComponent && mapComponent instanceof StandardMap) {
            return mapComponent.positions.items.map((facet) => {
                const roomUniversalKey = facet.reference.universalKey
                if (!roomUniversalKey) {
                    return undefined
                }
                const roomComponent = standardForm.byUniversalId[roomUniversalKey]
                if (roomComponent && roomComponent instanceof StandardRoom) {
                    // Skip Remove operations - they don't represent visible positions
                    if (facet.payload instanceof PositionRemoveClass) {
                        return undefined
                    }
                    
                    // Use .plain pattern to access the underlying payload base
                    // For Plain: .plain returns StandardPositionPayloadBase
                    // For Replace: .plain returns the payload (new value) StandardPositionPayloadBase
                    // For Remove: .plain returns the match, but we skip those above
                    const plainPayload = facet.payload.plain
                    if (!plainPayload) {
                        return undefined
                    }
                    
                    return {
                        roomId: roomUniversalKey as `ROOM#${string}`,
                        id: roomUniversalKey as `ROOM#${string}`,
                        x: plainPayload.x,
                        y: plainPayload.y,
                        shortName: roomComponent.shortName?._payload?.plain?.toJSON() ?? ''
                    }
                }
                return undefined
            }).filter(excludeUndefined)
        }
        return []
    }
    return [...(inherited ? localPositionsFromSingleStandardForm(inherited) : []), ...localPositionsFromSingleStandardForm(local)]
}

export const MapDisplayController: FunctionComponent<{ standardForm: StandardForm; mapId: `MAP#${string}`; children?: ReactNode }> = ({ standardForm, mapId, children }) => {

    //
    // Make local data and setters for node positions denormalized for display
    //
    const [localPositions, setLocalPositions] = useState<MapContextPosition[]>(localPositionsFromStandardForms({ local: standardForm, mapId }))
    const onTick = useCallback((nodes: SimNode[]) => {
        setLocalPositions(nodes.map(({ id, x, y }) => {
            const roomComponent = standardForm.byUniversalId[id]
            if (roomComponent && roomComponent instanceof StandardRoom) {
                return {
                    roomId: id as `ROOM#${string}`,
                    id: id as `ROOM#${string}`,
                    x,
                    y,
                    shortName: roomComponent.shortName?._payload?.plain?.toJSON() ?? ''
                }
            }
            else {
                return {
                    roomId: id as `ROOM#${string}`,
                    id: id as `ROOM#${string}`,
                    x,
                    y,
                    shortName: ''
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
            standardForm,
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
