import React, { FunctionComponent, PropsWithChildren } from 'react'
import { useGesture } from '@use-gesture/react'
import { MapReducerAction } from './maps'

type RoomGestureProps = PropsWithChildren<{
    roomId: string;
    localDispatch: (action: MapReducerAction) => void;
}>

//
// TODO: Design appropriate calling architecture that will permit wrapping the
// dynamically configured useGesture hook around a component that does not
// need to know about them
//
export const RoomGestures:FunctionComponent<RoomGestureProps> = ({ roomId, children }) => {
    const bind = {}
    return <React.Fragment>{ React.Children.map(children, (child: any) => (React.cloneElement(child, bind))) }</React.Fragment>
}