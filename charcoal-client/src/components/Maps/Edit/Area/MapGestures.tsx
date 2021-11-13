import React, { FunctionComponent, PropsWithChildren, useContext, useMemo } from 'react'
import { useGesture } from '@use-gesture/react'
import { MapAreaReducerAction, ToolSelected } from './area'
import ToolSelectContext from './ToolSelectContext'

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
    const toolSelected = useContext<ToolSelected>(ToolSelectContext)
    const bind = useGesture({
        onDragStart: () => {
            localDispatch({
                type: 'STARTDRAG',
                lockThreshold: zLevel
            })
        },
        onDrag: ({ offset: [ x, y ] }: { offset: [number, number] }) => {
            if (toolSelected === 'Move') {
                const destX = Math.max(-265, Math.min(265, (x / scale) - 300))
                const destY = Math.max(-165, Math.min(165, (y / scale) - 200))
                localDispatch({
                    type: 'SETNODE',
                    roomId,
                    x: destX,
                    y: destY
                })
            }
        },
        onDragEnd: () => {
            if (toolSelected === 'Move') {
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