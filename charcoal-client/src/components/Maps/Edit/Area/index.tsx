import React, { FunctionComponent, useReducer, useEffect, useState } from 'react'

// import useMapStyles from '../useMapStyles'
import {
    MapTree
} from '../maps'
import MapDThree from '../MapDThree'
import { SimNode, SimCallback } from '../MapDThree/baseClasses'
import MapDisplay from './MapDisplay'
import mapAreaReducer, { treeToVisible } from './reducer'
import { MapDispatch } from '../reducer.d'

type MapAreaProps = {
    fileURL?: string;
    tree: MapTree;
    dispatch: MapDispatch;
    onStabilize?: SimCallback;
}

const backgroundOnClick = (dispatch: MapDispatch): React.MouseEventHandler<SVGElement> => ({ clientX, clientY }) => {
    dispatch({ type: 'addRoom', x: clientX, y: clientY })
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ fileURL, tree, dispatch, onStabilize = () => {} }) => {
    // const localClasses = useMapStyles()

    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })
    const [{ rooms, exits }, mapDispatch] = useReducer(mapAreaReducer, tree, (tree: MapTree) => {
        const mapD3 = new MapDThree({
            tree,
            onExitDrag: setExitDrag,
            onAddExit: (fromRoomId, toRoomId, double) => {
                dispatch({ type: 'addExit', fromRoomId, toRoomId, double })
            }
        })
        const { rooms, exits } = treeToVisible(tree)
        return { mapD3, rooms, exits, tree }
    })
    useEffect(() => {
        mapDispatch({
            type: 'SETCALLBACKS',
            callback: (nodes: SimNode[]) => { mapDispatch({ type: 'TICK', nodes }) },
            stabilityCallback: (value: SimNode[]) => {
                mapDispatch({ type: 'STABILIZE' })
                onStabilize(value)
            }
        })
    }, [mapDispatch])
    useEffect(() => {
        mapDispatch({
            type: 'UPDATETREE',
            tree
        })
    }, [tree, mapDispatch])

    const exitDragSourceRoom = exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))
    const decoratorCircles = exitDragSourceRoom
        ? [
            { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
            { x: exitDrag.x, y: exitDrag.y }
        ]: []
    //
    // TODO: Derive double from the current toolSelect setting somewhere along the line
    //
    const decoratorExits = exitDragSourceRoom
        ? [{ fromX: exitDragSourceRoom.x, fromY: exitDragSourceRoom.y, toX: exitDrag.x, toY: exitDrag.y, double: true }]: []
    return <MapDisplay
        fileURL={fileURL}
        rooms={rooms}
        exits={exits}
        mapDispatch={mapDispatch}
        onClick={backgroundOnClick(dispatch)}
        decoratorCircles={decoratorCircles}
        decoratorExits={decoratorExits}
    />

}

export default MapArea
