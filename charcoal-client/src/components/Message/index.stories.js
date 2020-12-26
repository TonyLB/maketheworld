import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

import { PolymorphicMessage } from './index'
import CharacterAvatar from '../CharacterAvatar'
import MessageContent from './MessageContent'
import MessageThread from './MessageThread'
import MessageTime from './MessageTime'

const mockStore = configureStore()
const store = mockStore({
    characters: {
        TESS: {
            CharacterId: 'TESS',
            Name: 'Tess',
        },
        MARCO: {
            CharacterId: 'MARCO',
            Name: 'Marco',
        }
    },
    charactersInPlay: {
        TESS: {
            CharacterId: 'TESS',
            Connected: true,
            color: { primary: "pink" }
        },
        MARCO: {
            CharacterId: 'MARCO',
            Connected: true,
            color: { primary: "green" }
        }
    }
})

const MessageStory = {
  title: 'Message/PolymorphicMessage',
  component: PolymorphicMessage,
  argTypes: {
    CharacterId: {
        control: {
            type: 'select',
            options: ['TESS', 'MARCO', 'UNKNOWN']
        },
        description: 'Id of Character to fetch from Redux',
        table: {
            category: 'Data'
        }
    },
    viewAsCharacterId: {
        control: {
            type: 'select',
            options: ['TESS', 'MARCO', 'UNKNOWN']
        },
        description: 'Id of Character to fetch from Redux',
        table: {
            category: 'Data'
        }
    }
  }
}

export default MessageStory

const InPlayTemplate = (args) => <Provider store={store}>
    <PolymorphicMessage viewAsCharacterId={args.viewAsCharacterId}>
        <CharacterAvatar CharacterId={args.CharacterId} />
        <MessageContent>
            Test Message
        </MessageContent>
    </PolymorphicMessage>
</Provider>

export const InPlay = InPlayTemplate.bind({})
InPlay.args = {
    CharacterId: 'TESS',
    viewAsCharacterId: 'TESS'
}

const ThreadedTemplate = (args) => <Provider store={store}>
    <PolymorphicMessage viewAsCharacterId={args.viewAsCharacterId}>
        <CharacterAvatar CharacterId={args.CharacterId} />
        <MessageContent>
            Test Message
        </MessageContent>
        <MessageThread thread='ABC' />
        <MessageTime time={1608489657688} />
    </PolymorphicMessage>
</Provider>

export const Threaded = ThreadedTemplate.bind({})
Threaded.args = {
    CharacterId: 'TESS',
    viewAsCharacterId: 'TESS'
}