import React, { ReactChild, ReactChildren } from 'react'

import PlayerMessage from './PlayerMessage'
import WorldMessage from './WorldMessage'
import RoomDescription from './RoomDescription'
import UnknownMessage from './UnknownMessage'

import { Message as MessageType } from '../../slices/messages/baseClasses'

interface MessageProps {
    message: MessageType;
    children?: ReactChild | ReactChildren;
}

export const Message = ({ message, ...rest }: MessageProps) => {
    const { DisplayProtocol } = message
    switch(DisplayProtocol) {
        case 'Player':
        case 'SayMessage':
        case 'NarrateMessage':
            return <PlayerMessage message={message} {...rest} />
        case 'WorldMessage':
            return <WorldMessage message={message} {...rest} />
        case 'RoomDescription':
        case 'RoomHeader':
            return <RoomDescription message={message} {...rest} />
        default:
            return <UnknownMessage message={message} />
    }
    // else if (message instanceof announcementMessage) {
    //     return <AnnouncementMessage ref={ref} Message={message.Message} Title={message.Title} {...rest} />
    // }
    // else if (message instanceof directMessage) {
    //     return <DirectMessage ref={ref} message={message} {...rest} />
    // }
}

export default Message