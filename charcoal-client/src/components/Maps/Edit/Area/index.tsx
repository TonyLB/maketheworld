import React, { FunctionComponent, useCallback, useMemo } from 'react'

import MapDisplay from './MapDisplay'
import { useMapContext } from '../../Controller'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import { extractExitsFromStandardForm } from '../../exitExtraction'
import { useDispatch } from 'react-redux'
import { addOnboardingComplete } from '../../../../slices/player/index.api'

type MapAreaProps = {
    fileURL?: string;
    editMode?: boolean;
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ fileURL, editMode }) => {
    const { standardForm } = useLibraryAsset()
    const { UI: { toolSelected, exitDrag, itemSelected }, localPositions: rooms, mapId, mapDispatch } = useMapContext()
    const dispatch = useDispatch()
    const exits = useMemo(() => (extractExitsFromStandardForm(standardForm, mapId)), [standardForm, mapId])

    const exitDragSourceRoom = useMemo(() => (exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))), [exitDrag, rooms])
    const decoratorCircles = useMemo(() => {
        return exitDragSourceRoom
            ? [
                { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
                { x: exitDrag.x, y: exitDrag.y }
            ]: []
    }, [exitDragSourceRoom, exitDrag])
    const highlightCursor = useMemo(() => (
        toolSelected === 'AddRoom' && itemSelected?.type === 'UnshownRoomNew'
    ), [toolSelected, itemSelected?.type])
    //
    // TODO: Derive double from the current toolSelect setting somewhere along the line
    //
    const decoratorExits = exitDragSourceRoom
        ? [{ fromX: exitDragSourceRoom.x, fromY: exitDragSourceRoom.y, toX: exitDrag.x, toY: exitDrag.y, double: true }]: []

    //
    // Create an onClick that maps to the current settings to add a room
    //
    const onClick = useCallback(({ clientX, clientY }: { clientX: number; clientY: number }) => {
        if (itemSelected) {
            switch(itemSelected.type) {
                case 'UnshownRoom':
                    mapDispatch({ type: 'AddRoom', roomId: itemSelected.key as `ROOM#${string}`, x: clientX, y: clientY })
                    mapDispatch({ type: 'SelectItem' })
                    break
                case 'UnshownRoomNew':
                    dispatch(addOnboardingComplete(['positionNewRoom']))
                    mapDispatch({ type: 'AddRoom', x: clientX, y: clientY })
            }
        }
    }, [itemSelected, mapDispatch, dispatch])
    return <React.Fragment>
        <MapDisplay
            fileURL={fileURL}
            exits={exits}
            onClick={onClick}
            decoratorCircles={decoratorCircles}
            decoratorExits={decoratorExits}
            editMode={editMode}
            highlightCursor={highlightCursor}
        />
    </React.Fragment>

}

export default MapArea
