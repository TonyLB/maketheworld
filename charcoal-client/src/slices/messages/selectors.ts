import { createSelector } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import { Message, MessageState, RoomHeader } from './baseClasses'
import { Selector } from '../../store'


export const getMessages: Selector<MessageState> = (state) => {
    const handlerLookup = (obj: Record<string | symbol, Message[]>, prop: string | symbol): Message[] => (obj[prop] || [])
    return new Proxy(state.messages, {
        get: (target: MessageState, property: string | symbol) => (handlerLookup(target, property.toString())),
        ownKeys: (messages: MessageState) => {
            return (Object.keys(messages) as string[]).sort()
        },
        getOwnPropertyDescriptor: (obj, prop) => {
            const value = handlerLookup(obj, prop)
            return {
                configurable: Object.getOwnPropertyDescriptor(obj, prop)?.configurable,
                enumerable: Boolean(obj[prop.toString()]),
                value
            }
        }
    })

}

type MessageRoomBreakdownHeader = {
    header: RoomHeader;
    messageCount: number;
}

export type MessageRoomBreakdown = {
    Messages: Message[];
    Groups: MessageRoomBreakdownHeader[];
}

type MessageRoomInProgress = {
    Messages: Message[];
    Groups: MessageRoomBreakdownHeader[];
    currentGroup: MessageRoomBreakdownHeader;
}

const combineCurrentHeader = ({ Messages, Groups, currentGroup }: MessageRoomInProgress, newMessage?: RoomHeader): MessageRoomInProgress => {
    if (currentGroup.messageCount > 0) {
        return {
            Messages,
            Groups: [
                ...Groups,
                currentGroup
            ],
            currentGroup: {
                header: newMessage || currentGroup.header,
                messageCount: 0
            }
        }
    }
    else {
        return {
            Messages: [
                ...Messages,
                {
                    DisplayProtocol: 'SpacerMessage',
                    MessageId: `MESSAGE#${uuidv4()}`,
                    Target: currentGroup.header.Target,
                    CreatedTime: currentGroup.header.CreatedTime + 1
                }
            ],
            Groups: [
                ...Groups,
                {
                    header: currentGroup.header,
                    messageCount: 1
                }
            ],
            currentGroup: {
                header: newMessage || currentGroup.header,
                messageCount: 0
            }
        }
    }
}

export const getMessagesByRoom: (CharacterId: string) => Selector<MessageRoomBreakdown> = (CharacterId) => createSelector(
    getMessages,
    (allMessages) => {
        let messages = [] as Message[]
        let initialHeader = undefined as MessageRoomBreakdownHeader | undefined
        const probeMessages = allMessages[CharacterId]
        if (!probeMessages.length) {
            return {
                Messages: [],
                Groups: []
            }
        }
        if (probeMessages[0].DisplayProtocol === 'RoomHeader') {
            initialHeader = {
                header: probeMessages[0],
                messageCount: 0
            }
            messages = probeMessages.slice(1)
        }
        else {
            initialHeader = {
                header: {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'NONE',
                    Target: CharacterId,
                    RoomId: 'NONE',
                    CreatedTime: probeMessages[0].CreatedTime,
                    Name: 'Unknown',
                    Description: [{ tag: 'String', value: '??????' }],
                    Exits: [],
                    Characters: []
                },
                messageCount: 0
            }
            messages = probeMessages
        }
        const aggregate: MessageRoomInProgress = messages.reduce((previous, message) => {
                switch(message.DisplayProtocol) {
                    case 'RoomHeader':
                        if (message.RoomId === previous.currentGroup.header.RoomId) {
                            return {
                                Messages: previous.Messages,
                                Groups: previous.Groups,
                                currentGroup: {
                                    header: {
                                        ...previous.currentGroup.header,
                                        Name: message.Name,
                                        Description: message.Description,
                                        Characters: message.Characters,
                                        Exits: message.Exits
                                    },
                                    messageCount: previous.currentGroup.messageCount
                                }
                            }
                        }
                        else {
                            return combineCurrentHeader(previous, message)
                        }
                    case 'RoomUpdate':
                        return {
                            Messages: previous.Messages,
                            Groups: previous.Groups,
                            currentGroup: {
                                header: {
                                    ...previous.currentGroup.header,
                                    ...{
                                        Name: message.Name || previous.currentGroup.header.Name,
                                        Description: message.Description || previous.currentGroup.header.Description,
                                        Characters: message.Characters || previous.currentGroup.header.Characters,
                                        Exits: message.Exits || previous.currentGroup.header.Exits
                                    }
                                } as RoomHeader,
                                messageCount: previous.currentGroup.messageCount
                            }
                        }
                    default:
                        return {
                            Messages: [
                                ...previous.Messages,
                                message
                            ],
                            Groups: previous.Groups,
                            currentGroup: {
                                header: previous.currentGroup.header,
                                messageCount: previous.currentGroup.messageCount + 1
                            }
                        }
                }
            }, {
                Messages: [],
                Groups: [],
                currentGroup: initialHeader
            } as MessageRoomInProgress)
        const { currentGroup: discard, ...rest } = combineCurrentHeader(aggregate)
        return rest
    }
)