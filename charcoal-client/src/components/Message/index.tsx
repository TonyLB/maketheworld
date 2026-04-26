import React, { ReactChild, ReactChildren, ReactNode, useCallback } from 'react'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'

import SayMessage from './SayMessage'
import NarrateMessage from './NarrateMessage'
import OOCMessage from './OOCMessage'
import WorldMessage from './WorldMessage'
import WorldOOCMessage from './WorldOOCMessage'
import CoyoteHelpMessage from './CoyoteHelpMessage'
import RoomDescription from './RoomDescription'
import ComponentDescription from './ComponentDescription'
import SpacerMessage from './SpacerMessage'
import UnknownMessage from './UnknownMessage'

import { 
    Message as MessageType, 
    PerceptionMessage,
    PerceptionRoomMetaData,
    isPerceptionRoomMetaData,
    isPerceptionFeatureMetaData,
    isPerceptionKnowledgeMetaData,
    isPerceptionCharacterMetaData
} from '@tonylb/mtw-interfaces/ts/messages'
import { useActiveCharacter } from '../ActiveCharacter'
import CharacterDescription from './CharacterDescription'
import { useDispatch } from 'react-redux'
import { EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

interface MessageProps {
    message: MessageType;
    children?: ReactNode;
}

export const Message = ({ message, ...rest }: MessageProps) => {
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    const onClickLink: (to: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraCharacterId) => void = useCallback((to) => {
        dispatch(socketDispatchPromise({
            message: 'link',
            to,
            CharacterId
        }))
    }, [dispatch, CharacterId])
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
        case 'WorldOOCMessage':
            return <WorldOOCMessage message={message} {...rest} />
        case 'CoyoteGameHelpMessage':
            return <CoyoteHelpMessage message={message} {...rest} />
        case 'PerceptionMessage':
            // Handle PerceptionMessage by routing to appropriate component based on metaData or fallback to component type
            const perceptionMessage = message as PerceptionMessage & { parsedWML?: StandardForm }
            
            // Use metaData if available, otherwise fall back to componentUUID for backward compatibility
            const metaData = perceptionMessage.metaData
            
            if (perceptionMessage.parsedWML) {
                // Use metaData-based routing with type guards for enhanced type safety
                if (metaData && isPerceptionRoomMetaData(metaData)) {
                    const isGeneratingHeader = metaData.status === 'generating' && metaData.displayMode === 'header'
                    return <RoomDescription 
                        parsedWML={perceptionMessage.parsedWML}
                        metaData={metaData}
                        header={metaData.displayMode === 'header'}
                        isGenerating={isGeneratingHeader}
                        {...rest} 
                    />
                }
                
                if (metaData && isPerceptionKnowledgeMetaData(metaData)) {
                    return <ComponentDescription 
                        parsedWML={perceptionMessage.parsedWML}
                        metaData={metaData}
                        icon={<KnowledgeIcon />} 
                        bevel="2em" 
                        onClickLink={onClickLink} 
                        {...rest} 
                    />
                }
                
                if (metaData && isPerceptionFeatureMetaData(metaData)) {
                    return <ComponentDescription 
                        parsedWML={perceptionMessage.parsedWML}
                        metaData={metaData}
                        icon={<FeatureIcon />} 
                        onClickLink={onClickLink} 
                        {...rest} 
                    />
                }
                
                // Fallback to legacy component type detection for backward compatibility
                const componentUUID = metaData.componentUUID
                const component = perceptionMessage.parsedWML.byUniversalId[componentUUID]
                const componentType = component?.tag
                
                switch(componentType) {
                    case 'Knowledge':
                        return <ComponentDescription 
                            parsedWML={perceptionMessage.parsedWML}
                            metaData={metaData}
                            icon={<KnowledgeIcon />} 
                            bevel="2em" 
                            onClickLink={onClickLink} 
                            {...rest} 
                        />
                    case 'Feature':
                        return <ComponentDescription 
                            parsedWML={perceptionMessage.parsedWML}
                            metaData={metaData}
                            icon={<FeatureIcon />} 
                            onClickLink={onClickLink} 
                            {...rest} 
                        />
                    case 'Room':
                        // Create fallback metadata for Room type
                        const fallbackRoomMetaData: PerceptionRoomMetaData = {
                            componentUUID: componentUUID as EphemeraRoomId,
                            displayMode: 'full'
                        }
                        return <RoomDescription 
                            parsedWML={perceptionMessage.parsedWML}
                            metaData={fallbackRoomMetaData}
                            {...rest} 
                        />
                    // Add other cases as we implement them
                    default:
                        return <UnknownMessage message={message} />
                }
            }
            return <UnknownMessage message={message} />
        case 'SpacerMessage':
            return <SpacerMessage message={message} />
        case 'RoomUpdate':
            return null
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