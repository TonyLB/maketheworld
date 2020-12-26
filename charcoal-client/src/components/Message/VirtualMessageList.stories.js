import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import { LoremIpsum } from 'lorem-ipsum'

import VirtualMessageList from './VirtualMessageList'

const VirtualMessageListStory = {
  title: 'Message/VirtualMessageList',
  component: VirtualMessageList,
  argTypes: {
    messages: {
        control: { type: 'array' },
        description: 'Messages to (potentially) display',
        table: {
            category: 'Data'
        }
    }
  }
}

export default VirtualMessageListStory

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
      }
  }
})
const whoIsActive = ['TESS', 'MARCO', 'ASAHINA']

const testMessages = [...Array(500).keys()].map((index) => {
  const CharacterId = whoIsActive[Math.floor(Math.random() * 3)]
  return {
    CharacterId,
    Message: lorem.generateSentences(1).trim(),
    MessageTime: 1608489657688 + index * 30000
  }
})

const Template = (args) => <Provider store={store}>
    <div style={{ position: "absolute", width: "600px", height: "400px" }}>
        <VirtualMessageList {...args} />
    </div>
</Provider>

export const Default = Template.bind({})
Default.args = {
    messages: testMessages
}
