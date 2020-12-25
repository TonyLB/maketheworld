import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

import { CharacterAvatar } from './index';

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

const CharacterAvatarStory = {
  title: 'CharacterAvatar/CharacterAvatar',
  component: CharacterAvatar,
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
    alreadyNested: {
        control: { type: 'boolean' },
        description: 'Whether the avatar needs a wrapping div to set color class inheritance',
        table: {
            category: 'Presentation'
        }
    },
    viewAsSelf: {
        control: { type: 'boolean' },
        description: 'Whether the avatar is being viewed by its own player',
        table: {
            category: 'Presentation'
        }
    }
  }
}

export default CharacterAvatarStory

const Template = (args) => <Provider store={store}><CharacterAvatar {...args} /></Provider>

export const Default = Template.bind({})
Default.args = {
    CharacterId: 'TESS',
    alreadyNested: false
}
