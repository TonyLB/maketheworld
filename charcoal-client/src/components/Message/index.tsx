import React, { ReactChild, ReactChildren } from 'react'

import SayMessage from './SayMessage'
import NarrateMessage from './NarrateMessage'
import OOCMessage from './OOCMessage'
import WorldMessage from './WorldMessage'
import RoomDescription from './RoomDescription'
import SpacerMessage from './SpacerMessage'
import UnknownMessage from './UnknownMessage'

import { Message as MessageType } from '../../slices/messages/baseClasses'
import { useActiveCharacter } from '../ActiveCharacter'

interface MessageProps {
    message: MessageType;
    children?: ReactChild | ReactChildren;
}

export const Message = ({ message, ...rest }: MessageProps) => {
    const { CharacterId } = useActiveCharacter()
    const { DisplayProtocol } = message
    switch(DisplayProtocol) {
        case 'SayMessage':
            return <SayMessage message={message} variant={message.CharacterId === CharacterId ? 'right' : 'left'} />
        case 'NarrateMessage':
            return <NarrateMessage message={message} variant={message.CharacterId === CharacterId ? 'right' : 'left'} />
        case 'OOCMessage':
            return <OOCMessage message={message} variant={message.CharacterId === CharacterId ? 'right' : 'left'} />
        case 'WorldMessage':
            return <WorldMessage message={message} {...rest} />
        case 'RoomDescription':
        case 'RoomHeader':
            return <RoomDescription message={message} {...rest} />
        case 'SpacerMessage':
            return <SpacerMessage message={message} />
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