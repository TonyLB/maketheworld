import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import { LoremIpsum } from 'lorem-ipsum'

import ThreadView from './ThreadView'

const ThreadViewStory = {
  title: 'Threads/ThreadView',
  component: ThreadView,
  argTypes: {
    ThreadId: {
        control: {
            type: 'select',
            options: ['111', '222']
        },
        description: 'Thread to display',
        table: {
            category: 'Data'
        }
    },
    viewAsCharacterId: {
        control: {
            type: 'select',
            options: ['TESS', 'MARCO', 'ASAHINA']
        },
        description: 'Character to view as',
        table: {
            category: 'Presentation'
        }
    }
  }
}

export default ThreadViewStory

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
      max: 8,
      min: 4
  },
  wordsPerSentence: {
      max: 16,
      min: 4
  }
})

const whoIsActive = ['TESS', 'MARCO', 'ASAHINA']

const testMessages = [...Array(500).keys()].map((index) => {
  const CharacterId = whoIsActive[Math.floor(Math.random() * 3)]
  return {
    CharacterId,
    ThreadId: '222',
    Message: `${index}. ${lorem.generateSentences(1).trim()}`,
    MessageTime: 1608489657688 + index * 30000
  }
})

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
        },
        ASAHINA: {
            CharacterId: 'ASAHINA',
            Name: 'Asahina'
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
        },
        ASAHINA: {
          CharacterId: 'MARCO',
          Connected: true,
          color: { primary: "purple" }
        },
    },
    messages: [
        {
            Message: 'So what do we do about regularly scheduled events during festival time?  We don\'t want players feeling torn about what to attend.',
            MessageTime: 1608489657688,
            ThreadId: '111',
            CharacterId: 'MARCO'
        },
        {
            Message: 'Shouldn\'t the organizers of the regular events be doing something special anyway?  Like, releasing classes to go to the festival, or something?',
            MessageTime: 1608489757688,
            ThreadId: '111',
            CharacterId: 'TESS'
        },
        ...testMessages
    ],
    clientSettings: {
        ShowNeighborhoodHeaders: true
    }
})

const Template = (args) => <Provider store={store}>
    <div style={{ position: "absolute", width: "800px", height: "400px" }}>
        <ThreadView {...args} />
    </div>
</Provider>

export const Default = Template.bind({})
Default.args = {
    ThreadId: '111',
    viewAsCharacterId: 'TESS'
}

export const Lorem = Template.bind({})
Lorem.args = {
    ThreadId: '222',
    viewAsCharacterId: 'TESS'
}
