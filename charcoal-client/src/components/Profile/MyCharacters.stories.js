import React from 'react';

import { MyCharacters } from './MyCharacters';

const MyCharactersStory = {
  title: 'Profile/MyCharacters',
  component: MyCharacters,
  argTypes: {
    myCharacters: {
      control: {
        type: 'object'
      },
      description: 'List of character info objects',
      table: {
          category: 'Data'
      }
    },
    editCharacter: {
      action: 'editCharacter',
      defaultValue: null,
      description: 'Called when the pencil icon is clicked',
      table: {
          category: 'Events'
      }
    },
    connectCharacter: {
      action: 'connectCharacter',
      defaultValue: null,
      description: 'Called when the person icon is clicked',
      table: {
          category: 'Events'
      }
    }
  }
}

export default MyCharactersStory

const Template = (args) => <MyCharacters {...args} />

export const Basic = Template.bind({})
Basic.args = {
  myCharacters: [
    {
      CharacterId: '1',
      Name: 'Tess'
    },
    {
      CharacterId: '2',
      Name: 'Marco'
    }
  ]
}
