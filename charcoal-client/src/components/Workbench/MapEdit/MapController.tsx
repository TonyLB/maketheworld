import React, { FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"

import { MapContextItemSelected, MapContextPosition, MapDispatchAction, ToolSelected } from "../../Maps/Controller/baseClasses"
import MapDThree from "../../Maps/Edit/MapDThree"
import { SimNode } from "../../Maps/Edit/MapDThree/baseClasses"
import { addExitFactory } from "../../Maps/Controller/addExit"
import { addRoomFactory } from "../../Maps/Controller/addRoom"
import { useDispatch } from "react-redux"

import { addImportToDraft, getTopLevelAddToReferenceList } from "../../../slices/personalAssets"
import { addOnboardingComplete } from "../../../slices/player/index.api"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"

import { excludeUndefined } from "../../../lib/lists"
import { StandardPositionFacet, PositionRemoveClass } from "@tonylb/mtw-wml/ts/standardize/keys/facets/position"
import { mapTreeMemo, MapContext as OriginalMapContext, useMapContext as originalUseMapContext } from "../../Maps/Controller/index"

// Re-export MapContext and useMapContext for workbench components
export const MapContext = OriginalMapContext
export const useMapContext = originalUseMapContext

// Copy of localPositionsFromStandardForms from Maps/Controller/index.tsx (not exported there)
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
                    if (facet.payload instanceof PositionRemoveClass) {
                        return undefined
                    }
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

export const MapController: FunctionComponent<{ mapId: `MAP#${string}`; children?: ReactNode }> = ({ children, mapId }) => {
    const { AssetId, localStandardForm, inheritedStandardForm, standardForm, updateStandard } = useWorkbenchAsset()
    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    const [itemSelected, setItemSelected] = useState<MapContextItemSelected | undefined>(undefined)
    const dispatch = useDispatch()

    const editable: StandardForm = useMemo(() => (mapTreeMemo(localStandardForm, mapId)), [localStandardForm, mapId])
    const inherited: StandardForm = useMemo(() => (mapTreeMemo(inheritedStandardForm, mapId)), [inheritedStandardForm, mapId])

    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: `ROOM#${string}`; x: number; y: number }>({ sourceRoomId: 'ROOM#', x: 0, y: 0 })

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
    }, [setLocalPositions, editable])

    const onStability = useCallback((nodes: SimNode[]) => {
        const update = (standard: StandardForm) => {
            const draft = standard._clone()
            const mapComponent = draft.byUniversalId[mapId]
            if (mapComponent && mapComponent instanceof StandardMap) {
                nodes.forEach(({ id, x, y }) => {
                    const facetIndex = mapComponent.positions.items.findIndex((facet) => facet.reference.universalKey === id)
                    if (facetIndex !== -1) {
                        const facet = mapComponent.positions.items[facetIndex]
                        const updatedFacet = new StandardPositionFacet({
                            reference: facet.reference.toJSON(),
                            payload: { x, y }
                        })
                        mapComponent.positions.items[facetIndex] = updatedFacet
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
                updateStandard({
                    type: 'update',
                    update: (draft) => {
                        const ref = addImportToDraft(draft, { fromAsset: originAssetId, uuid: roomId, tag: 'Room' })
                        const descriptor = getTopLevelAddToReferenceList(draft)
                        if (ref && descriptor) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
                        return draft
                    }
                })
                return 'added'
            }
        }
        return 'notFound'
    }, [inherited, editable, updateStandard])

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
                const unlockRoomId = action.roomId
                if (unlockRoomId && isSchemaComponentUUID(unlockRoomId) && unlockRoomId.startsWith('ROOM#')) {
                    if (maybeAddImport(unlockRoomId as `ROOM#${string}`) === 'added') {
                        addRoomFactory({ mapId, standard: editable, updateStandard })({ roomId: unlockRoomId as `ROOM#${string}` })
                    }
                }
                return

        }
    }, [AssetId, mapD3, mapId, dispatchParentId, setToolSelected, setItemSelected, editable, updateStandard, dispatch, inherited, maybeAddImport])
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
    }, [mapD3, dispatch, mapId, standardForm, editable, updateStandard, onTick, onStability, maybeAddImport])
    useEffect(() => {
        mapDispatch({ type: 'UpdateTree', inherited, editable } as any)
    }, [mapDispatch, inherited, editable])
    useEffect(() => () => {
        mapD3.unmount()
    }, [mapD3])

    return <MapContext.Provider
        value={{
            mapId,
            standardForm,
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

export default MapController
