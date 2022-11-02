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
import { MapReducer } from './reducer.d'
import mapReducer from './reducer'
import { useLibraryAsset } from '../../Library/Edit/LibraryAsset'
import normalToTree from './normalToTree'
import { objectEntryMap, objectMap } from '../../../lib/objects'
import { MapAppearance, isNormalImage } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { InheritedExit } from '../../../slices/personalAssets/inheritedData'

type MapEditProps = {
}

export const MapEdit: FunctionComponent<MapEditProps>= () => {
    const localClasses = useMapStyles()
    const { normalForm, rooms, wmlQuery, updateWML } = useLibraryAsset()
    const { MapId: mapId } = useParams<{ MapId: string }>()

    const [toolSelected, setToolSelected] = useState<ToolSelected>('Select')
    //
    // TODO: Extend importDefaults to properly fetch inherited exits from ancestor assets, and then
    // put back the inheritedExits and inheritedAppearances functionality in normalToTree that shows
    // locked prior layers of map functionality.
    //
    const inheritedExits: InheritedExit[] = []
    const defaultTree = useMemo(() => (
        normalToTree({ MapId: mapId || '', normalForm, rooms, inheritedExits, inheritedAppearances: [] })
    ), [normalToTree, mapId, normalForm, rooms, inheritedExits])
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
    const onStabilize = useCallback((values) => {
        const normalMap = normalForm[mapId || '']
        if (normalMap?.tag === 'Map') {
            const newPositions: Record<string, { x: number; y: number; }> = values.reduce((previous: Record<string, { x: number; y: number }>, { roomId, x, y }: { roomId: string; x: number; y: number }) => ({
                ...previous,
                [roomId]: { x: Math.round(x), y: Math.round(y) }
            }), {} as Record<string, { x: number; y: number; }>)
            //
            // TODO: Right now this update is very naive about the possibility of multiple default layers.  Make it smarter as the layer-handling
            // functionality of MapEdit becomes more sophisticated
            //
            const locationsToUpdate: Record<string, number[]> = (normalMap.appearances)
                .filter(({ contextStack = [] }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .reduce((previous, { rooms = [] }) => ({
                    ...previous,
                    ...rooms.map(({ location }) => (location))
                }), {})
            const updatesNeeded = Object.entries(newPositions)
                .filter(([roomId]) => (locationsToUpdate[roomId]))
                .map(([roomId, { x, y }]) => ({
                    x,
                    y,
                    searchString:[
                        'Asset',
                        ...(locationsToUpdate[roomId].slice(1).map((index) => (`:nthChild(${index})`)))
                    ].join('')
                }))
            if (updatesNeeded.length) {
                updatesNeeded.forEach(({ searchString, x, y }) => {
                    wmlQuery.search(searchString).prop('x', `${x}`).prop('y', `${y}`)
                })
                updateWML(wmlQuery.source)
            }
        }
        
    }, [normalForm, mapId, wmlQuery, updateWML])

    const onAddExit = useCallback(({ to, from }: { to: string; from: string }) => {
        const outgoingQuery = wmlQuery.search(`Room[key="${from}"] Exit[to="${to}"]`).not("If Exit")
        const incomingQuery = wmlQuery.search(`Room[key="${to}"] Exit[from="${from}"]`).not("If Exit")
        if (outgoingQuery.nodes().length === 0 && incomingQuery.nodes().length === 0) {
            wmlQuery.search(`Room[key="${from}"]`).not("If Room").add(':first').addElement(`<Exit to=(${to}) />`, { position: 'after' })
            updateWML(wmlQuery.source)
        }
    }, [wmlQuery, updateWML])

    const onAddRoom = useCallback(({ clientX, clientY, roomId }: { clientX: number; clientY: number; roomId: string }) => {
        wmlQuery.search(`Map[key="${mapId}"]`).not('If Map').add(':first').addElement(`<Room key=(${roomId}) x="${clientX}" y="${clientY}" />`, { position: 'after' })
        updateWML(wmlQuery.source)
    }, [wmlQuery, updateWML])

    return <ToolSelectContext.Provider value={toolSelected}>
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
                <MapLayers tree={tree} dispatch={dispatch} />
            </div>
        </div>
    </ToolSelectContext.Provider>
}

export default MapEdit
