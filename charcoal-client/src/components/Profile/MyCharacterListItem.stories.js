import React from 'react';
import {
    List
} from '@material-ui/core'

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
            defaultValue: 'INITIAL',
            options: [
                'INITIAL',
                'FETCHING',
                'FETCHED',
                'SUBSCRIBING',
                'SUBSCRIBED',
                'UNSUBSCRIBING',
                'SYNCHING',
                'SYNCHRONIZED',
                'REGISTERING',
                'REGISTERED',
                'DEREGISTERING',
                'REREGISTERING'
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
    onSubscribe: {
        action: 'onSubscribe',
        defaultValue: null,
        description: 'Called when the person icon is clicked',
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
    state: 'INITIAL'
}
