import React from 'react';
import {
    List
} from '@material-ui/core'

import {
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_RECONNECTING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED
} from '../../actions/activeCharacters'


import { PureMyCharacterListItem as MyCharacterListItem } from './MyCharacterListItem';

const MyCharacterListItemStory = {
  title: 'Profile/MyCharacterListItem',
  component: MyCharacterListItem,
  argTypes: {
    Name: {
        control: { type: 'text' },
        description: 'Name of character',
        table: {
            category: 'Data'
        }
    },
    CharacterId: {
        control: { type: 'text' },
        description: 'Internal ID of character',
        table: {
            category: 'Data'
        }
    },
    state: {
        control: {
            type: 'select',
            defaultValue: ACTIVE_CHARACTER_FSM_INITIAL,
            options: [
                ACTIVE_CHARACTER_FSM_INITIAL,
                ACTIVE_CHARACTER_FSM_SUBSCRIBING,
                ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                ACTIVE_CHARACTER_FSM_CONNECTING,
                ACTIVE_CHARACTER_FSM_CONNECTED,
                ACTIVE_CHARACTER_FSM_RECONNECTING
            ]
        },
        description: 'State of the activeCharacter record',
        table: {
            category: 'Data'
        }

    },
    onEdit: {
        action: 'onEdit',
        defaultValue: null,
        description: 'Called when the pencil icon is clicked',
        table: {
            category: 'Events'
        }
    },
    onConnect: {
        action: 'onConnect',
        defaultValue: null,
        description: 'Called when the person icon is clicked',
        table: {
            category: 'Events'
        }
    }
  }
}

export default MyCharacterListItemStory

const Template = (args) => <List><MyCharacterListItem {...args} /></List>

export const Basic = Template.bind({})
Basic.args = {
    Name: 'Tess',
    CharacterId: '1',
    state: ACTIVE_CHARACTER_FSM_INITIAL
}
