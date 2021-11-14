import React, { FunctionComponent } from 'react'

import {
    Switch,
    Route,
    Link,
    useRouteMatch,
    useHistory
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import MapList from './List/'
import MapEdit from './Edit/'

type MapHomeProps = {}

export const MapHome: FunctionComponent<MapHomeProps> = ({}) => {

    const { path, url } = useRouteMatch()
    useAutoPin({ href: `/Maps/`, label: `Maps`})

    return <Switch>
        <Route exact path={path}>
            <MapList />
        </Route>
        <Route path={`${path}Edit/:mapId/`}>
            <MapEdit />
        </Route>
    </Switch>

}

export default MapHome
