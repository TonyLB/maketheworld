import React from 'react'

import {
    playerMessage, roomDescription, announcementMessage
} from '../../store/messages'
import PlayerMessage from './PlayerMessage'
import WorldMessage from './WorldMessage'
import RoomDescriptionMessage from './RoomDescriptionMessage'
import AnnouncementMessage from './AnnouncementMessage'

export const Message = ({ message, ...rest }) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage message={message} {...rest} />
    }
    else if (message instanceof roomDescription) {
        return <RoomDescriptionMessage inline message={message} {...rest} />
    }
    else if (message instanceof announcementMessage) {
        return <AnnouncementMessage Message={message.Message} Title={message.Title} {...rest} />
    }
    return <WorldMessage message={message} {...rest} />
}

export default Message