import React, { FunctionComponent, useMemo } from 'react'

import MapDisplay from './MapDisplay'
import { useMapContext } from '../../Controller'
import { MapTreeExit, MapTreeItem } from '../../Controller/baseClasses'
import { GenericTree } from '@tonylb/mtw-sequence/dist/tree/baseClasses'

type MapAreaProps = {
    fileURL?: string;
}

export const treeToExits = (tree: GenericTree<MapTreeItem>): MapTreeExit[] => {
    return tree.reduce<MapTreeExit[]>((
        previous,
        { data, children }
    ) => {
        const childResult = treeToExits(children)
        switch(data.tag) {
            case 'Exit':
                return [
                    ...previous,
                    data,
                    ...childResult
                ]
            default:
                return [...previous, ...childResult]
        }
    }, [])
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ fileURL }) => {

    const { UI: { exitDrag }, localPositions: rooms, tree } = useMapContext()
    const exits = useMemo(() => (treeToExits(tree)), [tree])

    const exitDragSourceRoom = exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))
    const decoratorCircles = [
        ...(exitDragSourceRoom
            ? [
                { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
                { x: exitDrag.x, y: exitDrag.y }
            ]: []
        )
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
