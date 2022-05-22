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
import { MapDispatch } from '../reducer.d'
import { AddRoomDialog } from './AddRoomDialog'

type MapAreaProps = {
    fileURL?: string;
    tree: MapTree;
    dispatch: MapDispatch;
    onStabilize?: SimCallback;
    onAddExit?: (props: { from: string; to: string }) => void;
    onAddRoom?: (props: { from: string; to: string }) => void;
}

const backgroundOnClick = ({ setDialogOpen, setClickPosition }: { setDialogOpen: (value: boolean) => void, setClickPosition: (value: { clientX: number, clientY: number }) => void }): React.MouseEventHandler<SVGElement> => ({ clientX, clientY }) => {
    //
    // TODO: Instead of immediately adding the room, raise an AddRoomDialog to find out which ID and name
    //
    // dispatch({ type: 'addRoom', x: clientX, y: clientY })

    setDialogOpen(true)
    setClickPosition({ clientX, clientY })
}

export const MapArea: FunctionComponent<MapAreaProps>= ({
    fileURL,
    tree,
    dispatch,
    onStabilize = () => {},
    onAddExit = () => {},
    onAddRoom = () => {}
}) => {

    //
    // TODO: Add state for recording raised/lowered state of the dialog, state variables to record clientX and clientY
    // from a background click (holding them until completion of the dialog) and some lifted variables to pass off
    // key and name from inside the dialog itself.
    //

    const { MapId: mapId } = useParams<{ MapId: string }>()

    const [exitDrag, setExitDrag] = useState<{ sourceRoomId: string; x: number; y: number }>({ sourceRoomId: '', x: 0, y: 0 })
    const [dialogOpen, setDialogOpen] = useState<boolean>(false)
    const [clickPosition, setClickPosition ] = useState<{ clientX: Number, clientY: number } | null>(null)
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
            onExitDrag: setExitDrag,
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
    return <React.Fragment>
        <AddRoomDialog
            open={dialogOpen}
            mapId={mapId || ''}
            roomId={addRoomId || ''}
            onChange={setAddRoomId}
            onClose={onCloseDialog}
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
