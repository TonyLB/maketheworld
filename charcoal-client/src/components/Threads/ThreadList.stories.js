import React from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

import {
    List
} from '@material-ui/core'

import { ThreadList } from './ThreadList'

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
        },
        MARCO: {
            CharacterId: 'MARCO',
            Connected: true,
            color: { primary: "green" }
        }
    }
})

const ThreadListStory = {
  title: 'Threads/ThreadList',
  component: ThreadList,
  argTypes: {
    threads: {
        control: { type: 'array' },
        description: 'List of threads',
        table: {
            category: 'Data'
        }
    },
    onView: {
        action: 'onView',
        defaultValue: null,
        description: 'Called when a thread header is clicked',
        table: {
            category: 'Events'
        }
    }
  }
}

export default ThreadListStory

const Template = (args) => <Provider store={store}><List><ThreadList {...args} /></List></Provider>

export const Default = Template.bind({})
Default.args = {
    threads: [
        {
            Subject: 'Festival Planning',
            ThreadId: '1',
            characters: ['TESS', 'MARCO']
        },
        {
            Subject: 'Ruined Temple Raid',
            ThreadId: '2',
            characters: ['TESS', 'ASAHINA']
        }
    ]
}
