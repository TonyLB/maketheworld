import React from 'react'

import {
    playerMessage, roomDescription
} from '../../store/messages'
import PlayerMessage from './PlayerMessage'
import WorldMessage from './WorldMessage'
import RoomDescriptionMessage from './RoomDescriptionMessage'

export const Message = ({ message, ...rest }) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage message={message} {...rest} />
    }
    else if (message instanceof roomDescription) {
        return <RoomDescriptionMessage message={message} {...rest} />
    }
    return <WorldMessage message={message} {...rest} />
}

export default Message