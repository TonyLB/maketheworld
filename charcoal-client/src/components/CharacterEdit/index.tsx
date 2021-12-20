import React, { FunctionComponent } from 'react'

import {
    Switch,
    Route,
    Link,
    useRouteMatch,
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import CharacterEditForm from './EditForm'

type CharacterEditProps = {}

export const CharacterEdit: FunctionComponent<CharacterEditProps> = ({}) => {

    const { path, url } = useRouteMatch()
    useAutoPin({ href: `/Character/New/`, label: `New Character`})

    return <Switch>
        <Route exact path={path}>
            <CharacterEditForm characterId="New" />
        </Route>
        {/* <Route path={`${path}Edit/:mapId/`}>
            <CharacterEditForm />
        </Route> */}
    </Switch>

}

export default CharacterEdit
