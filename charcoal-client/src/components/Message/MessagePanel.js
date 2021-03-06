import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from "prop-types"

import { makeStyles } from "@material-ui/core/styles"

import VirtualMessageList from './VirtualMessageList'
import { parseCommand } from '../../actions/behaviors'
import LineEntry from '../LineEntry'
import useStyles from '../styles'
import { useActiveCharacter } from '../ActiveCharacter'

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
    const { CharacterId, inPlayMessages } = useActiveCharacter()
    const handleInput = useCallback((entry) => {
        dispatch(parseCommand({ entry, raiseError: () => {} }))
        return true
    }, [dispatch])
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
