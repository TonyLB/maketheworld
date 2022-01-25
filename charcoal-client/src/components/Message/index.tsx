import React, { ReactChild, ReactChildren } from 'react'

import SayMessage from './SayMessage'
import NarrateMessage from './NarrateMessage'
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
        case 'SayMessage':
            return <SayMessage message={message} />
        case 'NarrateMessage':
            return <NarrateMessage message={message} />
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