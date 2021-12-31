import React, { FunctionComponent, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../slices/navigationTabs/useAutoPin'
import CharacterEditForm from './EditForm'
import { addItem } from '../../slices/characterEdit/ssmVersion'
import { ssmHeartbeat } from '../../slices/stateSeekingMachine/index'

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
    const dispatch = useDispatch()
    useEffect(() => {
        if (CharacterKey && CharacterKey !== 'New') {
            dispatch(addItem(CharacterKey))
            dispatch(ssmHeartbeat(uuidv4()))
        }
    }, [dispatch, CharacterKey, ssmHeartbeat, addItem])

    return <CharacterEditForm characterKey={CharacterKey || ''} />

}

export default CharacterEdit
