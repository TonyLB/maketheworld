import React, { FunctionComponent, useReducer, useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

// import useMapStyles from '../useMapStyles'
import {
    MapTree
} from '../maps'
import MapDThree from '../MapDThree'
import { SimNode, SimCallback } from '../MapDThree/baseClasses'
import MapDisplay from './MapDisplay'
import mapAreaReducer, { treeToVisible, treeToMapLayers } from './reducer'
import { MapDispatch } from '../reducer'
import { AddRoomDialog } from './AddRoomDialog'
import { useMapContext } from '../../Controller'

type MapAreaProps = {
    fileURL?: string;
    tree: MapTree;
    dispatch: MapDispatch;
    onStabilize?: SimCallback;
    onAddExit?: (props: { from: string; to: string }) => void;
    onAddRoom?: (props: { clientX: number; clientY: number; roomId: string }) => void;
}

const backgroundOnClick = ({ setDialogOpen, setClickPosition }: { setDialogOpen: (value: boolean) => void, setClickPosition: (value: { clientX: number, clientY: number }) => void }): React.MouseEventHandler<SVGElement> => ({ clientX, clientY }) => {
    setDialogOpen(true)
    setClickPosition({ clientX, clientY })
}

//
// TODO: ISS3228: Lift mapD3 property into MapContext
//

//
// TODO: ISS3228: Refactor MapArea to use MapContext data rather than be passed a tree
//
export const MapArea: FunctionComponent<MapAreaProps>= ({
    fileURL,
    tree,
    dispatch,
    onStabilize = () => {},
    onAddExit = () => {},
    onAddRoom = () => {}
}) => {

    const { MapId: mapId } = useParams<{ MapId: string }>()

    const { UI: { exitDrag }, mapDispatch: contextMapDispatch } = useMapContext()
    const [dialogOpen, setDialogOpen] = useState<boolean>(false)
    const [clickPosition, setClickPosition ] = useState<{ clientX: number, clientY: number } | null>(null)
    const [addRoomId, setAddRoomId] = useState<string>('')
    const onCloseDialog = useCallback(() => {
        setDialogOpen(false)
        setAddRoomId('')
        setClickPosition(null)
    }, [setDialogOpen, setAddRoomId, setClickPosition])
    const [{ rooms, exits }, mapDispatch] = useReducer(mapAreaReducer, tree, (tree: MapTree) => {
        const { rooms, exits } = treeToVisible(tree)
        const mapD3 = new MapDThree({
            roomLayers: treeToMapLayers(tree),
            exits: exits.map(({ name, toRoomId, fromRoomId }) => ({ key: name, to: toRoomId, from: fromRoomId, visible: true })),
            onExitDrag: (value) => { contextMapDispatch({ type: 'SetExitDrag', ...value })},
            onAddExit: (fromRoomId, toRoomId, double) => {
                dispatch({ type: 'addExit', fromRoomId, toRoomId, double })
                onAddExit({ from: fromRoomId, to: toRoomId })
                if (double) {
                    onAddExit({ from: toRoomId, to: fromRoomId })
                }
            }
        })
        return { mapD3, rooms, exits, tree }
    })
    useEffect(() => () => {
        mapDispatch({ type: 'UNMOUNT' })
    }, [])
    const onSaveDialog = useCallback(() => {
        if (clickPosition) {
            onAddRoom({ ...clickPosition, roomId: addRoomId })
        }
        setDialogOpen(false)
        setAddRoomId('')
        setClickPosition(null)
    }, [clickPosition, addRoomId, onAddRoom, mapDispatch])
    useEffect(() => {
        mapDispatch({
            type: 'SETCALLBACKS',
            callback: (nodes: SimNode[]) => { mapDispatch({ type: 'TICK', nodes }) },
            stabilityCallback: (value: SimNode[]) => {
                mapDispatch({ type: 'STABILIZE' })
                onStabilize(value)
            }
        })
    }, [mapDispatch, onStabilize])
    useEffect(() => {
        mapDispatch({
            type: 'UPDATETREE',
            tree
        })
    }, [tree, mapDispatch])

    const exitDragSourceRoom = exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))
    const decoratorCircles = [
        ...(exitDragSourceRoom
            ? [
                { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
                { x: exitDrag.x, y: exitDrag.y }
            ]: []
        ),
        ...(clickPosition
            ? [ { x: clickPosition.clientX, y: clickPosition.clientY }]
            : []
        )
    ]
    //
    // TODO: Derive double from the current toolSelect setting somewhere along the line
    //
    const decoratorExits = exitDragSourceRoom
        ? [{ fromX: exitDragSourceRoom.x, fromY: exitDragSourceRoom.y, toX: exitDrag.x, toY: exitDrag.y, double: true }]: []
    console.log(`exitDrag: ${JSON.stringify(exitDrag, null, 4)}`)
    console.log(`decoratorExits: ${JSON.stringify(decoratorExits, null, 4)}`)
    console.log(`rooms: ${JSON.stringify(rooms, null, 4)}`)
    return <React.Fragment>
        <AddRoomDialog
            open={dialogOpen}
            mapId={mapId || ''}
            roomId={addRoomId || ''}
            onChange={setAddRoomId}
            onClose={onCloseDialog}
            onSave={onSaveDialog}
        />
        <MapDisplay
            fileURL={fileURL}
            rooms={rooms}
            exits={exits}
            mapDispatch={mapDispatch}
            onClick={backgroundOnClick({ setDialogOpen, setClickPosition })}
            decoratorCircles={decoratorCircles}
            decoratorExits={decoratorExits}
        />
    </React.Fragment>

}

export default MapArea
