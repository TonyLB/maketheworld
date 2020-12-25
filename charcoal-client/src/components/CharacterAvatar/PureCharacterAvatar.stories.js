import React from 'react';

import { PureCharacterAvatar } from './PureCharacterAvatar';

const PureCharacterAvatarStory = {
  title: 'CharacterAvatar/PureCharacterAvatar',
  component: PureCharacterAvatar,
  argTypes: {
    Name: {
        control: { type: 'text' },
        description: 'Name of character',
        table: {
            category: 'Data'
        }
    },
    color: {
        control: {
            type: 'select',
            options: ['blue', 'green', 'pink', 'purple']
        },
        description: 'Color to present the avatar',
        table: {
            category: 'Presentation'
        }
    },
    alreadyNested: {
        control: { type: 'boolean' },
        description: 'Whether the avatar needs a wrapping div to set color class inheritance',
        table: {
            category: 'Presentation'
        }
    }
  }
}

export default PureCharacterAvatarStory

const Template = (args) => <PureCharacterAvatar {...args} />

export const Default = Template.bind({})
Default.args = {
    Name: 'Tess',
    color: 'blue',
    alreadyNested: false
}