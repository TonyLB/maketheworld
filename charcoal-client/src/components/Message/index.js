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

export const Message = React.forwardRef(({ message, ...rest }, ref) => {
    if (message instanceof playerMessage) {
        return <PlayerMessage ref={ref} message={message} {...rest} />
    }
    else if (message instanceof roomDescription) {
        return <RoomDescriptionMessage inline ref={ref} message={message} {...rest} />
    }
    else if (message instanceof neighborhoodDescription) {
        return <NeighborhoodDescriptionMessage ref={ref} message={message} {...rest} />
    }
    else if (message instanceof announcementMessage) {
        return <AnnouncementMessage ref={ref} Message={message.Message} Title={message.Title} {...rest} />
    }
    else if (message instanceof directMessage) {
        return <DirectMessage ref={ref} message={message} {...rest} />
    }
    return <WorldMessage ref={ref} message={message} {...rest} />
})

export default Message