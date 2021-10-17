import React, { FunctionComponent, PropsWithChildren } from 'react'
import { useGesture } from '@use-gesture/react'
import { MapReducerAction } from './maps'

type RoomGestureProps = PropsWithChildren<{
    roomId: string;
    localDispatch: (action: MapReducerAction) => void;
    x: number;
    y: number;
    scale: number;
}>

//
// TODO: Design appropriate calling architecture that will permit wrapping the
// dynamically configured useGesture hook around a component that does not
// need to know about them
//
export const RoomGestures:FunctionComponent<RoomGestureProps> = ({ roomId, x, y, scale, localDispatch, children }) => {
    const bind = useGesture({
        onDrag: ({ offset: [ x, y ]}) => {
            const destX = Math.max(-265, Math.min(265, (x / scale) - 300))
            const destY = Math.max(-165, Math.min(165, (y / scale) - 200))
            localDispatch({
                type: 'SETNODE',
                roomId,
                x: destX,
                y: destY
            })
        },
        onDragEnd: () => {
            localDispatch({ type: 'ENDDRAG' })
        }
    },
    {
        drag: {
            from: () => [x * scale, y * scale]
        }
    })
    return <React.Fragment>{ React.Children.map(children, (child: any) => (React.cloneElement(child, bind()))) }</React.Fragment>
}