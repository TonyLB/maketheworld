import React, { useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from "prop-types"

import { makeStyles } from "@material-ui/core/styles"

import VirtualMessageList from './VirtualMessageList'
import { getMessages } from '../../selectors/messages'
import { parseCommand } from '../../actions/behaviors'
import LineEntry from '../LineEntry'
import useStyles from '../styles'

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

export const MessagePanel = ({
    viewAsCharacterId
}) => {
    const dispatch = useDispatch()
    const classes = useStyles()
    const localClasses = useMessagePanelStyles()
    const messages = useSelector(getMessages)
    const nonThreadMessages = useMemo(() => (messages.filter((message) => (message.ThreadId === undefined))), [messages])
    const handleInput = useCallback((entry) => {
        dispatch(parseCommand({ entry, raiseError: () => {} }))
        return true
    }, [dispatch])
    return <div className={localClasses.messagePanel}>
            <div className={localClasses.messagePanelContent}>
                <VirtualMessageList messages={nonThreadMessages} viewAsCharacterId={viewAsCharacterId} />
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
