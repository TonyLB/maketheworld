import React, { FunctionComponent } from 'react'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import CharacterEditForm from './EditForm'

type CharacterEditProps = {}

//
// TODO: Step 5
//
// Add spinner for pending fetch state
//

// eslint-disable-next-line no-empty-pattern
export const CharacterEdit: FunctionComponent<CharacterEditProps> = ({}) => {

    const { CharacterKey } = useParams<{ CharacterKey: string }>()
    useAutoPin({
        href: `/Character/Edit/${CharacterKey}`,
        label: CharacterKey === 'New' ? `New Character` : `Edit: ${CharacterKey}`
    })

    return <CharacterEditForm characterKey={CharacterKey} />

}

export default CharacterEdit
