import React, { FunctionComponent } from 'react'

import {
    Routes,
    Route
} from "react-router-dom"

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import MapList from './List/'
import MapEdit from './Edit/'

// eslint-disable-next-line no-empty-pattern
type MapHomeProps = {}

//
// TODO: Either deprecate MapHome (not currently used) or extend it to deal with
// general maps outside the context of a specific character
//
export const MapHome: FunctionComponent<MapHomeProps> = () => {

    useAutoPin({ href: `/Maps/`, label: `Maps`, type: 'Library' })

    //
    // TODO: Migrate to react-router-dom@6+, in order to get rid
    // of this typescript error and access the new more powerful
    // router functions
    //
    return <Routes>
        <Route path={''} element={<MapList />} />
        <Route path={`Edit/:mapId/`} element={<MapEdit />} />
    </Routes>

}

export default MapHome
