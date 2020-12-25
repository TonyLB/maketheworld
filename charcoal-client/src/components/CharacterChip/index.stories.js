import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

import { CharacterChip } from './index';

const mockStore = configureStore()
const store = mockStore({
    characters: {
        TESS: {
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.'
        },
        MARCO: {
            CharacterId: 'MARCO',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth princess'
        }
    },
    charactersInPlay: {
        TESS: {
            CharacterId: 'TESS',
            Connected: true,
            color: { primary: "blue" }
        },
        MARCO: {
            CharacterId: 'MARCO',
            Connected: true,
            color: { primary: "green" }
        }
    }
})

const CharacterChipStory = {
  title: 'CharacterChip/CharacterChip',
  component: CharacterChip,
  argTypes: {
    CharacterId: {
        control: {
            type: 'select',
            options: ['TESS', 'MARCO', 'ASAHINA', 'UNKNOWN']
        },
        description: 'Id of Character to fetch from Redux',
        table: {
            category: 'Data'
        }
    }
  }
}

export default CharacterChipStory

const Template = (args) => <Provider store={store}><CharacterChip {...args} /></Provider>

export const Default = Template.bind({})
Default.args = {
    CharacterId: 'TESS'
}

const storeWithInactiveCharacter = mockStore({
    characters: {
        TESS: {
            CharacterId: 'TESS',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.'
        },
        ASAHINA: {
            CharacterId: 'ASAHINA',
            Name: 'Asahina',
            Pronouns: 'She/her',
            FirstImpression: 'Lightning warrior'
        }
    },
    charactersInPlay: {
        TESS: {
            CharacterId: 'TESS',
            Connected: true,
            color: { primary: "blue" }
        }
    }
})

const TemplateWithInactive = (args) => <Provider store={storeWithInactiveCharacter}><CharacterChip {...args} /></Provider>

export const WithInactiveCharacter = TemplateWithInactive.bind({})
WithInactiveCharacter.args = {
    CharacterId: 'ASAHINA'
}
