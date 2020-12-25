import React from 'react';
import {
    List
} from '@material-ui/core'

import { AddCharacterListItem } from './AddCharacterListItem';

const AddCharacterListItemStory = {
  title: 'Profile/AddCharacterListItem',
  component: AddCharacterListItem,
  argTypes: {
    onEdit: {
        action: 'onEdit',
        defaultValue: null,
        description: 'Called when the list item is clicked',
        table: {
            category: 'Events'
        }
    }
  }
}

export default AddCharacterListItemStory

const Template = (args) => <List><AddCharacterListItem {...args} /></List>

export const Basic = Template.bind({})
Basic.args = {
}
