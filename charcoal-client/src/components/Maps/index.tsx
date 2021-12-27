import React, { FunctionComponent } from 'react'

import {
    Switch,
    Route,
    useRouteMatch
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import MapList from './List/'
import MapEdit from './Edit/'

// eslint-disable-next-line no-empty-pattern
type MapHomeProps = {}

// eslint-disable-next-line no-empty-pattern
export const MapHome: FunctionComponent<MapHomeProps> = ({}) => {

    const { path } = useRouteMatch()
    useAutoPin({ href: `/Maps/`, label: `Maps`})

    //
    // TODO: Migrate to react-router-dom@6+, in order to get rid
    // of this typescript error and access the new more powerful
    // router functions
    //
    return <Switch>
        <Route /*exact*/ path={path}>
            <MapList />
        </Route>
        <Route path={`${path}Edit/:mapId/`}>
            <MapEdit />
        </Route>
    </Switch>

}

export default MapHome
