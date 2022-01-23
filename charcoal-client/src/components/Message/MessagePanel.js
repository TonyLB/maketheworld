import React, { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from "prop-types"

import makeStyles from '@mui/styles/makeStyles';

import VirtualMessageList from './VirtualMessageList'
import { parseCommand } from '../../slices/lifeLine'
import LineEntry from '../LineEntry'
import useStyles from '../styles'
import { useActiveCharacter } from '../ActiveCharacter'
import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { addItem } from '../../slices/activeCharacters'
import { heartbeat } from '../../slices/stateSeekingMachine/ssmHeartbeat'

const useMessagePanelStyles = makeStyles((theme) => ({
    messagePanel: {
        display: 'grid',
        height: '100%',
        position: 'relative',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr auto',
        gridTemplateAreas: `
            "messages"
            "input"
        `
    },
    messagePanelContent: {
        gridArea: 'messages',
        position: 'relative'
    },
    messagePanelInput: {
        gridArea: 'input',
        width: '100%'
    }
}))

export const MessagePanel = () => {
    const dispatch = useDispatch()
    const classes = useStyles()
    const localClasses = useMessagePanelStyles()
    const { CharacterId, inPlayMessages, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({ href: `/Character/${CharacterId}/Play`, label: `Play: ${Name}`})
    useEffect(() => {
        dispatch(addItem(CharacterId))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const handleInput = useCallback((entry) => {
        dispatch(parseCommand(CharacterId)({ entry, raiseError: () => {} }))
        return true
    }, [dispatch, CharacterId])
    return <div className={localClasses.messagePanel}>
            <div className={localClasses.messagePanelContent}>
                <VirtualMessageList messages={inPlayMessages} viewAsCharacterId={CharacterId} />
            </div>
            <div className={localClasses.messagePanelInput}>
                <LineEntry
                    className={classes.lineEntry}
                    callback={handleInput}
                />
            </div>
        </div>

}

MessagePanel.propTypes = {
    viewAsCharacterId: PropTypes.string
}

export default MessagePanel
