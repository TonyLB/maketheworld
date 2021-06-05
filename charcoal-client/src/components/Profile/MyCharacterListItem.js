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

import { getCharacters } from '../../selectors/characters'
import { subscribeCharacterSSM, connectCharacterSSM } from '../../actions/activeCharacters'
import { getActiveCharacters } from '../../selectors/activeCharacters'

export const PureMyCharacterListItem = ({
        CharacterId = '',
        Name = '',
        state = 'INITIAL',
        onEdit = () => {},
        onDisconnect = () => {},
        onSubscribe = () => {},
        onConnect = () => {},
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
            { (state === 'INITIAL') &&
                <Tooltip title={`Connect ${Name}`}>
                    <IconButton onClick={onSubscribe} >
                        <AccountIcon />
                    </IconButton>
                </Tooltip>
            }
            { (state === 'SYNCHRONIZED') &&
                <Tooltip title={`Connect ${Name}`}>
                    <IconButton onClick={onConnect} >
                        <ForumIcon />
                    </IconButton>
                </Tooltip>
            }
            { (['FETCHING', 'FETCHED', 'SUBSCRIBING', 'SUBSCRIBED', 'SYNCHING', 'REGISTERING', 'REREGISTERING'].includes(state)) &&
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
    onSubscribe: PropTypes.func,
    onConnect: PropTypes.func
}

export const MyCharacterListItem = ({
    CharacterId = '',
    onEdit = () => {},
    ...rest
}) => {
    const dispatch = useDispatch()
    const Name = useSelector(getCharacters)[CharacterId]?.Name
    const state = useSelector(getActiveCharacters)[CharacterId]?.state
    const onSubscribe = useCallback(() => {
        dispatch(subscribeCharacterSSM(CharacterId))
    }, [dispatch, CharacterId])
    const onConnect = useCallback(() => {
        dispatch(connectCharacterSSM(CharacterId))
    }, [dispatch, CharacterId])

    return <PureMyCharacterListItem
        CharacterId={CharacterId}
        Name={Name}
        state={state}
        onEdit={onEdit}
        onSubscribe={onSubscribe}
        onConnect={onConnect}
        {...rest}
    />
}

MyCharacterListItem.propTypes = {
    CharacterId: PropTypes.string,
    onEdit: PropTypes.func
}

export default MyCharacterListItem