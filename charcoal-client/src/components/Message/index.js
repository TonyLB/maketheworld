import React from 'react'

import {
    playerMessage,
    directMessage,
    roomDescription,
    announcementMessage,
    neighborhoodDescription
} from '../../store/messages'
import PlayerMessage from './PlayerMessage'
import DirectMessage from './DirectMessage'
import WorldMessage from './WorldMessage'
import RoomDescriptionMessage from './RoomDescriptionMessage'
import NeighborhoodDescriptionMessage from './NeighborhoodDescriptionMessage'
import AnnouncementMessage from './AnnouncementMessage'

export const Message = ({ message, ...rest }) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage message={message} {...rest} />
    }
    else if (message instanceof roomDescription) {
        return <RoomDescriptionMessage inline message={message} {...rest} />
    }
    else if (message instanceof neighborhoodDescription) {
        return <NeighborhoodDescriptionMessage message={message} {...rest} />
    }
    else if (message instanceof announcementMessage) {
        return <AnnouncementMessage Message={message.Message} Title={message.Title} {...rest} />
    }
    else if (message instanceof directMessage) {
        return <DirectMessage message={message} {...rest} />
    }
    return <WorldMessage message={message} {...rest} />
}

export default Message