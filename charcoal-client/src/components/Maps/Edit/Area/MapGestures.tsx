import React, { FunctionComponent, PropsWithChildren, useContext } from 'react'
import { useGesture } from '@use-gesture/react'
import { MAP_HEIGHT, MAP_WIDTH } from './constants'
import { MapAreaReducerAction } from './area'
import { useMapEditContext } from '../../Controller'

type RoomGestureProps = PropsWithChildren<{
    roomId: string;
    zLevel: number;
    localDispatch: (action: MapAreaReducerAction) => void;
    x: number;
    y: number;
    scale: number;
}>

//
// TODO: Design appropriate calling architecture that will permit wrapping the
// dynamically configured useGesture hook around a component that does not
// need to know about them
//
export const RoomGestures: FunctionComponent<RoomGestureProps> = ({ roomId, zLevel, x, y, scale, localDispatch, children }) => {
    const { toolSelected } = useMapEditContext()
    const bind = (useGesture as any)({
        onDrag: ({ offset: [ x, y ] }: { offset: [number, number] }) => {
            const destX = Math.max(-((MAP_WIDTH / 2) - 35), Math.min((MAP_WIDTH / 2) - 35, (x / scale) - (MAP_WIDTH / 2)))
            const destY = Math.max(-((MAP_HEIGHT / 2) - 35), Math.min((MAP_HEIGHT / 2) - 35, (y / scale) - (MAP_HEIGHT / 2)))
            switch(toolSelected) {
                case 'Move':
                    localDispatch({
                        type: 'SETNODE',
                        roomId,
                        x: destX,
                        y: destY
                    })
                    break;
                case 'OneWayExit':
                case 'TwoWayExit':
                    localDispatch({
                        type: 'DRAGEXIT',
                        roomId,
                        x: destX,
                        y: destY,
                        double: toolSelected === 'TwoWayExit'
                    })
                break;
            }
        },
        onDragEnd: () => {
            if (['Move', 'OneWayExit', 'TwoWayExit'].includes(toolSelected)) {
                localDispatch({ type: 'ENDDRAG' })
            }
        }
    },
    {
        drag: {
            from: () => [x * scale, y * scale]
        }
    })
    return <React.Fragment>{ React.Children.map(children, (child: any) => (React.cloneElement(child, bind()))) }</React.Fragment>
}