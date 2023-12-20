import React, { FunctionComponent, useCallback, useMemo } from 'react'

import MapDisplay from './MapDisplay'
import { useMapContext } from '../../Controller'
import { MapTreeExit, MapTreeItem } from '../../Controller/baseClasses'
import { GenericTree } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'

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

    const { UI: { toolSelected, exitDrag, itemSelected, cursorPosition }, localPositions: rooms, tree, mapDispatch } = useMapContext()
    const exits = useMemo(() => (treeToExits(tree)), [tree])

    const exitDragSourceRoom = exitDrag.sourceRoomId && rooms.find(({ roomId }) => (roomId === exitDrag.sourceRoomId))
    const decoratorCircles = [
        ...(exitDragSourceRoom
            ? [
                { x: exitDragSourceRoom.x, y: exitDragSourceRoom.y },
                { x: exitDrag.x, y: exitDrag.y }
            ]: []
        ),
        ...( toolSelected === 'AddRoom' && itemSelected && ['UnshownRoomNew', 'UnshownRoom'].includes(itemSelected.type) && cursorPosition
            ? [{ x: cursorPosition.x, y: cursorPosition.y }]
            : []
        )
    ]
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
                    mapDispatch({ type: 'AddRoom', roomId: itemSelected.key, x: clientX, y: clientY })
                    mapDispatch({ type: 'SelectItem' })
                    break
                case 'UnshownRoomNew':
                    mapDispatch({ type: 'AddRoom', x: clientX, y: clientY })
            }
        }
    }, [itemSelected, mapDispatch])
    return <React.Fragment>
        <MapDisplay
            fileURL={fileURL}
            exits={exits}
            onClick={onClick}
            decoratorCircles={decoratorCircles}
            decoratorExits={decoratorExits}
        />
    </React.Fragment>

}

export default MapArea
