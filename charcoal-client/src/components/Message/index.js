import React from 'react'

import {
    playerMessage
} from '../../store/messages'
import PlayerMessage from './PlayerMessage'
import WorldMessage from './WorldMessage'

export const Message = ({ message, ...rest }) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage message={message} {...rest} />
    }
    return <WorldMessage message={message} {...rest} />
}

export default Message