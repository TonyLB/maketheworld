import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import PropTypes from "prop-types"

import VirtualMessageList from '../Message/VirtualMessageList'

import { getMessages } from '../../selectors/messages'

export const ThreadView = ({
        ThreadId,
        viewAsCharacterId,
    }) => {
    const messages = useSelector(getMessages)
    const threadMessages = useMemo(() => (messages.filter((message) => (message.ThreadId === ThreadId))), [messages, ThreadId])
    return <VirtualMessageList key={ThreadId} messages={threadMessages} viewAsCharacterId={viewAsCharacterId} />

}

ThreadView.propTypes = {
    ThreadId: PropTypes.string,
    viewAsCharacterId: PropTypes.string
}

export default ThreadView