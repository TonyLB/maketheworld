import React, { FunctionComponent } from 'react'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import CharacterEditForm from './EditForm'

type CharacterEditProps = {}

//
// TODO: Step 3
//
// Expand character edit to break character fileName out of route and use
// it to look up data from redux
//

//
// TODO: Step 4
//
// Create async fetch to populate store from player assets
//

//
// TODO: Step 5
//
// Add spinner for pending fetch state
//

export const CharacterEdit: FunctionComponent<CharacterEditProps> = ({}) => {

    const { CharacterKey } = useParams<{ CharacterKey: string }>()
    useAutoPin({
        href: `/Character/Edit/${CharacterKey}`,
        label: CharacterKey === 'New' ? `New Character` : `Edit: ${CharacterKey}`
    })

    return <CharacterEditForm characterKey={CharacterKey} />

}

export default CharacterEdit
