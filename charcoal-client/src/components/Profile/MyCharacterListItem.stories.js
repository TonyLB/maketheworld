import React from 'react';
import {
    List
} from '@material-ui/core'

import { MyCharacterListItem } from './MyCharacterListItem';

export default {
  title: 'Profile/MyCharacterListItem',
  component: MyCharacterListItem,
  argTypes: {
    Name: {
        control: { type: 'string' },
        description: 'Name of character',
        table: {
            category: 'Data'
        }
    },
    CharacterId: {
        control: { type: 'string' },
        description: 'Internal ID of character',
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
};

const Template = (args) => <List><MyCharacterListItem {...args} /></List>

export const Basic = Template.bind({})
Basic.args = {
    Name: 'Tess',
    CharacterId: '1'
}
