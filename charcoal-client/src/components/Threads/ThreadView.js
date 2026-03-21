import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import PropTypes from "prop-types"

import VirtualMessageList from '../Message/VirtualMessageList'

//
// TODO: Refactor messages slice to handle threads
//
import { getPresentation } from '../../slices/messages'

export const ThreadView = ({
        ThreadId,
        viewAsCharacterId,
    }) => {
    const messages = useSelector(getPresentation)
    const threadMessages = useMemo(() => (messages.threads.filter((message) => (message.ThreadId === ThreadId))), [messages, ThreadId])
    return null
    // return <VirtualMessageList key={ThreadId} messages={threadMessages} viewAsCharacterId={viewAsCharacterId} />

}

ThreadView.propTypes = {
    ThreadId: PropTypes.string,
    viewAsCharacterId: PropTypes.string
}

export default ThreadView