import React, { FunctionComponent, useState, useReducer, useCallback, useMemo, useEffect } from 'react'

import {
    useParams
} from "react-router-dom"

import useMapStyles from './useMapStyles'
import MapArea from './Area'
import MapLayers from './MapLayers'
import { MapTree } from './maps'
import { ToolSelected } from './Area/area'
import ToolSelect from './Area/ToolSelect'
import ToolSelectContext from './Area/ToolSelectContext'
import mapReducer, { MapReducer } from './reducer'
import { useLibraryAsset } from '../../Library/Edit/LibraryAsset'
import normalToTree from './normalToTree'
import { deepEqual } from '../../../lib/objects'
import { MapAppearance, isNormalImage, isNormalMap, NormalReference, isNormalRoom } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { isSchemaMap, isSchemaRoom, SchemaMapLegalContents, SchemaRoomTag } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'
import { extractConditionedItemFromContents } from '@tonylb/mtw-wml/dist/simpleSchema/utils'
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import MapEditController from './Controller'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= () => {
    const localClasses = useMapStyles()
    const { normalForm, rooms, updateNormal } = useLibraryAsset()
    const { AssetId: assetKey, MapId: mapId } = useParams<{ AssetId: string; MapId: string }>()
    const AssetId = `ASSET#${assetKey}` as const
    useAutoPin({
        href: `/Library/Edit/Asset/${assetKey}/Map/${mapId}`,
        label: `${mapId}`,
        type: 'MapEdit',
        iconName: 'MapEdit',
        mapId: `MAP#${mapId}`,
        cascadingClose: true
    })

    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    //
    // TODO: Extract conditions and rooms from importDefaults
    //

    //
    // TODO: Extract conditions and rooms from normalForm
    //

    //
    // TODO: Display unconditioned rooms and exits
    //
    const defaultTree = useMemo(() => {
        return normalToTree({ MapId: mapId || '', normalForm, rooms, inheritedExits: [], inheritedAppearances: [] })
    }, [mapId, normalForm, rooms])
    const [{ tree }, dispatch] = useReducer<MapReducer, MapTree>(
        mapReducer,
        defaultTree,
        (tree) => ({ tree })
    )
    useEffect(() => {
        dispatch({
            type: 'updateTree',
            tree: defaultTree
        })
    }, [defaultTree, dispatch])

    //
    // TODO: Figure out how to extract fileURL from defaultAppearances
    //
    const mapImages = useMemo<string[]>(() => {
        const mapAppearances = (normalForm[mapId || '']?.appearances || []) as MapAppearance[]
        const images = mapAppearances
            .filter(({ contextStack = [] }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            .reduce<string[]>((previous, { images = [] }) => ([
                ...previous,
                ...(images
                    .map((image) => (normalForm[image]))
                    .filter(isNormalImage)
                    .map(({ fileURL = '' }) => (fileURL))
                    .filter((fileURL) => (fileURL))
                )
            ]), [] as string[])
        return images
    }, [normalForm, mapId])
    //
    // TODO: Figure out why onStabilize is not actually updating the normal in a way that results in the derived information
    // being brought up to date so that onStabilize will not keep looping
    //
    const onStabilize = useCallback((values) => {
        const normalMap = normalForm[mapId || '']
        if (mapId && isNormalMap(normalMap)) {
            let nameSet = false
            const newPositions: Record<string, { x: number; y: number; }> = values.reduce((previous: Record<string, { x: number; y: number }>, { roomId, x, y }: { roomId: string; x: number; y: number }) => ({
                ...previous,
                [roomId]: { x: Math.round(x), y: Math.round(y) }
            }), {} as Record<string, { x: number; y: number; }>)

            //
            // TODO: Right now this update is very naive about the possibility of multiple layers.  Make it smarter as the layer-handling
            // functionality of MapEdit becomes more sophisticated
            //
            const { tag, appearances = [] } = normalMap
            const normalizer = new Normalizer()
            normalizer._normalForm = normalForm
            appearances.forEach((appearance, index) => {
                const { contextStack } = appearance
                const reference: NormalReference = { tag, key: mapId, index }
                if (!contextStack.find(({ tag }) => (tag === 'If'))) {
                    const baseSchema = normalizer.referenceToSchema(reference)
                    if (isSchemaMap(baseSchema)) {
                        const roomContents = baseSchema.contents
                            .map((item) => (isSchemaRoom(item)
                                ? {
                                    ...item,
                                    ...(newPositions[item.key] || {})
                                } as SchemaRoomTag
                                : item
                            ))

                        if (!deepEqual(baseSchema.contents, nameSet ? [] : roomContents)) {
                            const position = normalizer._referenceToInsertPosition(reference)
                            updateNormal({
                                type: 'put',
                                item: {
                                    ...baseSchema,
                                    contents: nameSet ? [] : roomContents,
                                    rooms: nameSet ? [] : extractConditionedItemFromContents({
                                        contents: roomContents as SchemaMapLegalContents[],
                                        typeGuard: isSchemaRoom,
                                        transform: ({ key, x, y }, index) => ({ conditions: [], key, x: x ?? 0, y: y ?? 0, index })
                                    }),
                                },
                                position: { ...position, replace: true },
                            })
                        }
                        nameSet = true
                    }
                }
            })
    
        }
        
    }, [normalForm, mapId, updateNormal])

    const onAddExit = useCallback(({ to, from }: { to: string; from: string }) => {
        const normalRoom = normalForm[from || '']
        if (from && normalRoom && isNormalRoom(normalRoom)) {
            const firstUnconditionedAppearance = normalRoom.appearances.findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            if (firstUnconditionedAppearance !== -1) {
                updateNormal({
                    type: 'put',
                    item: {
                        tag: 'Exit',
                        key: `${from}#${to}`,
                        from,
                        to,
                        name: '',
                        contents: [],
                    },
                    position: { contextStack: [ ...normalRoom.appearances[firstUnconditionedAppearance].contextStack, { key: from, tag: 'Room', index: firstUnconditionedAppearance }] }
                })
            }
        }
    }, [normalForm, updateNormal])

    const onAddRoom = useCallback(({ clientX, clientY, roomId }: { clientX: number; clientY: number; roomId: string }) => {
        const normalMap = normalForm[mapId || '']
        if (mapId && normalMap && isNormalMap(normalMap)) {
            const firstUnconditionedAppearance = normalMap.appearances.findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            if (firstUnconditionedAppearance !== -1) {
                updateNormal({
                    type: 'put',
                    item: {
                        tag: 'Room',
                        key: roomId,
                        x: clientX,
                        y: clientY,
                        contents: [],
                        name: [],
                        render: [],
                    },
                    position: { contextStack: [ ...normalMap.appearances[firstUnconditionedAppearance].contextStack, { key: mapId, tag: 'Map', index: firstUnconditionedAppearance }] }
                })
            }
        }
    }, [normalForm, mapId, updateNormal])

    return <MapEditController mapId={mapId}>
        <ToolSelectContext.Provider value={toolSelected}>
            <div className={localClasses.grid}>
                <div className={localClasses.content} >
                    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                        <ToolSelect toolSelected={toolSelected} onChange={setToolSelected} />
                    </div>
                    <MapArea
                        fileURL={mapImages.length ? mapImages[0] : undefined}
                        tree={tree}
                        dispatch={dispatch}
                        onStabilize={onStabilize}
                        onAddExit={onAddExit}
                        onAddRoom={onAddRoom}
                    />
                </div>
                <div className={localClasses.sidebar} >
                    <MapLayers mapId={mapId} tree={tree} dispatch={dispatch} />
                </div>
            </div>
        </ToolSelectContext.Provider>
    </MapEditController>
}

export default MapEdit
