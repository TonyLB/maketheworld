import React, { FunctionComponent, useMemo } from 'react'

import {
    MapExit,
    MapTree
} from '../maps'
import MapDisplay from './MapDisplay'
import { useMapContext } from '../../Controller'

type MapAreaProps = {
    fileURL?: string;
    tree: MapTree;
}

export const treeToExits = (tree: MapTree): MapExit[] => {
    return tree.reduce<MapExit[]>((
        previous,
        { item, children, key },
        index
    ) => {
        if (!item.visible) {
            return previous
        }
        const childResult = treeToExits(children)
        switch(item.type) {
            case 'EXIT':
                return [
                    ...previous,
                    item,
                    ...childResult
                ]
            default:
                return [...previous, ...childResult]
        }
    }, [])
}

//
// TODO: ISS3228: Refactor MapArea to use MapContext data rather than be passed a tree
//
export const MapArea: FunctionComponent<MapAreaProps>= ({
    fileURL,
    tree
}) => {

    const { UI: { exitDrag }, localPositions: rooms } = useMapContext()
    const exits = useMemo(() => (treeToExits(tree)), [tree])

    const exitDragSourceRoom = exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))
    const decoratorCircles = [
        ...(exitDragSourceRoom
            ? [
                { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
                { x: exitDrag.x, y: exitDrag.y }
            ]: []
        ),
        // ...(clickPosition
        //     ? [ { x: clickPosition.clientX, y: clickPosition.clientY }]
        //     : []
        // )
    ]
    //
    // TODO: Derive double from the current toolSelect setting somewhere along the line
    //
    const decoratorExits = exitDragSourceRoom
        ? [{ fromX: exitDragSourceRoom.x, fromY: exitDragSourceRoom.y, toX: exitDrag.x, toY: exitDrag.y, double: true }]: []
    return <React.Fragment>
        <MapDisplay
            fileURL={fileURL}
            rooms={rooms}
            exits={exits}
            onClick={() => {}}
            decoratorCircles={decoratorCircles}
            decoratorExits={decoratorExits}
        />
    </React.Fragment>

}

export default MapArea
