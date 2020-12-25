import React from 'react';
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

import {
    List
} from '@material-ui/core'

import { ThreadListItem } from './ThreadListItem';

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

const ThreadListItemStory = {
  title: 'Threads/ThreadListItem',
  component: ThreadListItem,
  argTypes: {
    Subject: {
        control: { type: 'text' },
        description: 'Subject of thread',
        table: {
            category: 'Data'
        }
    },
    ThreadId: {
        control: { type: 'text' },
        description: 'Internal ID of thread',
        table: {
            category: 'Data'
        }
    },
    characters: {
        control: { type: 'array' },
        description: 'List of CharacterIds to show CharacterChips on item',
        table: {
            category: 'Data'
        }
    },
    onView: {
        action: 'onView',
        defaultValue: null,
        description: 'Called when the view icon is clicked',
        table: {
            category: 'Events'
        }
    }
  }
}

export default ThreadListItemStory

const Template = (args) => <Provider store={store}><List><ThreadListItem {...args} /></List></Provider>

export const Default = Template.bind({})
Default.args = {
    Subject: 'Festival Planning',
    ThreadId: '1',
    characters: ['TESS', 'MARCO']
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

const TemplateWithInactive = (args) => <Provider store={storeWithInactiveCharacter}><List><ThreadListItem {...args} /></List></Provider>

export const WithInactiveCharacter = TemplateWithInactive.bind({})
WithInactiveCharacter.args = {
    Subject: 'Ruined Temple Raid',
    ThreadId: '2',
    characters: ['TESS', 'ASAHINA']
}
