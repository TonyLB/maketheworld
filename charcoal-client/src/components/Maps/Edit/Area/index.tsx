import React, { FunctionComponent, useReducer, useEffect } from 'react'

import useMapStyles from '../useMapStyles'
import {
    MapTree
} from '../maps'
import MapDThree, { SimNode } from '../MapDThree'
import MapDisplay from './MapDisplay'
import mapAreaReducer, { treeToVisible } from './reducer'
import { MapDispatch } from '../reducer.d'

type MapAreaProps = {
    tree: MapTree;
    dispatch: MapDispatch;
}

//
// TODO: STEP 4
//
// Update MapGestures.tsx to handle the add-room UI mode, and to add rooms.
// Create a time-and-position debouncer to prevent rapid creation of streams of rooms.
//

const backgroundOnClick = (dispatch: MapDispatch): React.MouseEventHandler<SVGElement> => ({ clientX, clientY }) => {
    dispatch({ type: 'addRoom', x: clientX, y: clientY })
}

export const MapArea: FunctionComponent<MapAreaProps>= ({ tree, dispatch }) => {
    const localClasses = useMapStyles()

    //
    // TODO: Lift useGesture code from Map/EditMap.js, and wire it into a separate helper function here that
    // can be applied when the MapArea tool is in the correct mode (drag)
    //
    // In fact, make a whole toolbox of different gesture-spreads to apply to the room and exit objects.
    //
    //
    // TODO: Create a useReducer call here to keep a local state synchronized with the nodes of a MapDThree instance
    //
    const [{ rooms, exits }, mapDispatch] = useReducer(mapAreaReducer, tree, (tree: MapTree) => {
        const mapD3 = new MapDThree({ tree })
        const { rooms, exits } = treeToVisible(tree)
        return { mapD3, rooms, exits, tree }
    })
    useEffect(() => {
        mapDispatch({
            type: 'SETCALLBACKS',
            callback: (nodes: SimNode[]) => { mapDispatch({ type: 'TICK', nodes }) },
            stabilityCallback: () => { mapDispatch({ type: 'STABILIZE' })}
        })
    }, [mapDispatch])
    useEffect(() => {
        mapDispatch({
            type: 'UPDATETREE',
            tree
        })
    }, [tree, mapDispatch])

    return <MapDisplay rooms={rooms} exits={exits} mapDispatch={mapDispatch} onClick={backgroundOnClick(dispatch)} />

}

export default MapArea
