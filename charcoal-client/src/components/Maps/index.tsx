import React, { FunctionComponent } from 'react'

import {
    Routes,
    Route
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import MapList from './List/'
import MapEdit from './Edit/'

// eslint-disable-next-line no-empty-pattern
type MapHomeProps = {}

// eslint-disable-next-line no-empty-pattern
export const MapHome: FunctionComponent<MapHomeProps> = ({}) => {

    useAutoPin({ href: `/Maps/`, label: `Maps`})

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
