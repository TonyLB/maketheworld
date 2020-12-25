import React from 'react';

import { CharacterEdit } from './CharacterEdit';

const CharacterEditStory = {
  title: 'Profile/CharacterEdit',
  component: CharacterEdit,
  argTypes: {
    characterData: {
        control: { type: 'object' },
        description: 'Default starting character data.  Consists of: characterId, name, pronouns, firstImpression, oneCoolThing and outfit.',
        table: {
            category: 'Data'
        }
    },
    savePromiseFactory: {
        action: 'savePromiseFactory',
        defaultValue: null,
        description: 'Called when the edit saves data',
        table: {
            category: 'Events'
        }
    },
    closeEdit: {
        action: 'closeEdit',
        defaultValue: null,
        description: 'Called to navigate away from the character edit component',
        table: {
            category: 'Events'
        }
    }
  }
}

export default CharacterEditStory

const Template = (args) => <CharacterEdit {...args} />

export const FromDefaults = Template.bind({})
FromDefaults.args = {
    characterData: {
        CharacterId: '1',
        Name: 'Tess',
        Pronouns: 'She/her',
        FirstImpression: 'Frumpy Goth',
        OneCoolThing: 'Fuchsia eyes',
        Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily-dyed lace.',
        HomeId: 'ABC'
    }
}

export const Empty = Template.bind({})
Empty.args = {
    characterData: {}
}