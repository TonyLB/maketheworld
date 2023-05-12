import React, { ReactChild, ReactChildren } from 'react'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'

import SayMessage from './SayMessage'
import NarrateMessage from './NarrateMessage'
import OOCMessage from './OOCMessage'
import WorldMessage from './WorldMessage'
import RoomDescription from './RoomDescription'
import ComponentDescription from './ComponentDescription'
import SpacerMessage from './SpacerMessage'
import UnknownMessage from './UnknownMessage'

import { Message as MessageType } from '@tonylb/mtw-interfaces/dist/messages'
import { useActiveCharacter } from '../ActiveCharacter'
import CharacterDescription from './CharacterDescription'

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
            return <RoomDescription message={message} {...rest} />
        case 'RoomHeader':
            return <RoomDescription message={message} {...rest} header />
        case 'FeatureDescription':
            return <ComponentDescription message={message} icon={<FeatureIcon />} {...rest} />
        case 'KnowledgeDescription':
            return <ComponentDescription message={message} icon={<KnowledgeIcon />} bevel="2em" {...rest} />
        case 'CharacterDescription':
            return <CharacterDescription message={message} {...rest} />
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