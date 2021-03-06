import React, { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    Tooltip,
    IconButton,
    ListItem,
    ListItemText,
    ListItemSecondaryAction
} from '@material-ui/core'
import CreateIcon from '@material-ui/icons/Create'
import AccountIcon from '@material-ui/icons/AccountBox'
import ForumIcon from '@material-ui/icons/Forum'

import Spinner from '../Spinner'

import useStyles from '../styles'

import {
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_RECONNECTING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED
} from '../../actions/activeCharacters'

import { getCharacters } from '../../selectors/characters'
import { subscribeToMessages } from '../../actions/activeCharacters'
import { getActiveCharacters } from '../../selectors/activeCharacters'

export const PureMyCharacterListItem = ({
        CharacterId = '',
        Name = '',
        state = ACTIVE_CHARACTER_FSM_INITIAL,
        onEdit = () => {},
        onDisconnect = () => {},
        onSubscribe = () => {},
        ...rest
    }) => {
    const classes = useStyles()

    return <ListItem className={classes.characterSelectionListItem} {...rest} >
        <ListItemText>
            { Name }
        </ListItemText>
        <ListItemSecondaryAction>
            <Tooltip title={`Edit ${Name}`}>
                <IconButton onClick={onEdit} >
                    <CreateIcon />
                </IconButton>
            </Tooltip>
            { (state === ACTIVE_CHARACTER_FSM_INITIAL) &&
                <Tooltip title={`Connect ${Name}`}>
                    <IconButton onClick={onSubscribe} >
                        <AccountIcon />
                    </IconButton>
                </Tooltip>
            }
            { (state === ACTIVE_CHARACTER_FSM_SUBSCRIBED) &&
                <Tooltip title={`Connect ${Name}`}>
                    <IconButton onClick={() => {}} >
                        <ForumIcon />
                    </IconButton>
                </Tooltip>
            }
            { ([ACTIVE_CHARACTER_FSM_SUBSCRIBING, ACTIVE_CHARACTER_FSM_CONNECTING, ACTIVE_CHARACTER_FSM_RECONNECTING].includes(state)) &&
                <IconButton>
                    <Spinner />
                </IconButton>
            }
        </ListItemSecondaryAction>
    </ListItem>
}

PureMyCharacterListItem.propTypes = {
    CharacterId: PropTypes.string,
    Name: PropTypes.string,
    state: PropTypes.string,
    onEdit: PropTypes.func,
    onDisconnect: PropTypes.func,
    onSubscribe: PropTypes.func
}

export const MyCharacterListItem = ({
    CharacterId = '',
    onEdit = () => {},
    ...rest
}) => {
    const dispatch = useDispatch()
    const Name = useSelector(getCharacters)[CharacterId]?.Name
    const state = useSelector(getActiveCharacters)[CharacterId]?.state
    const onConnect = useCallback(() => {
        dispatch(subscribeToMessages(CharacterId))
    }, [dispatch, CharacterId])

    return <PureMyCharacterListItem
        CharacterId={CharacterId}
        Name={Name}
        state={state}
        onEdit={onEdit}
        onSubscribe={onConnect}
        {...rest}
    />
}

MyCharacterListItem.propTypes = {
    CharacterId: PropTypes.string,
    onEdit: PropTypes.func
}

export default MyCharacterListItem