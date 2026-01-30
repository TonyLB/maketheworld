import React, { FunctionComponent } from 'react'

import {
    Routes,
    Route
} from "react-router-dom"

import MapList from './List/'

// eslint-disable-next-line no-empty-pattern
type MapHomeProps = {}

//
// TODO: Either deprecate MapHome (not currently used) or extend it to deal with
// general maps outside the context of a specific character.
// Map edit flow is now in the workbench; legacy Library/Edit/Asset map route was removed.
//
export const MapHome: FunctionComponent<MapHomeProps> = () => {

    // Removed useAutoPin - tab navigation removed

    //
    // TODO: Migrate to react-router-dom@6+, in order to get rid
    // of this typescript error and access the new more powerful
    // router functions
    //
    return <Routes>
        <Route path={''} element={<MapList />} />
    </Routes>

}

export default MapHome
