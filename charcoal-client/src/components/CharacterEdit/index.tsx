import React, { FunctionComponent, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import CircularProgress from '@mui/material/CircularProgress'

import {
    useParams
} from "react-router-dom"

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import CharacterEditForm from './EditForm'
import { addItem, getStatus } from '../../slices/UI/characterEdit'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'
// import Spinner from '../Spinner'

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
            dispatch(heartbeat)
        }
    }, [dispatch, CharacterKey])

    const currentStatus = useSelector(getStatus(CharacterKey || 'none'))

    return currentStatus === 'PARSED'
        ? <CharacterEditForm characterKey={CharacterKey || ''} />
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default CharacterEdit
