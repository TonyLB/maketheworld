import React from 'react';

import { PureCharacterChip } from './PureCharacterChip';

const PureCharacterChipStory = {
  title: 'CharacterChip/PureCharacterChip',
  component: PureCharacterChip,
  argTypes: {
    Name: {
        control: { type: 'text' },
        description: 'Name of character',
        table: {
            category: 'Data'
        }
    },
    Pronouns: {
        control: { type: 'text' },
        description: 'Pronouns of character',
        table: {
            category: 'Data'
        }
    },
    FirstImpression: {
        control: { type: 'text' },
        description: 'First impression character gives off',
        table: {
            category: 'Data'
        }
    },
    OneCoolThing: {
        control: { type: 'text' },
        description: 'One cool thing about the character',
        table: {
            category: 'Data'
        }
    },
    Outfit: {
        control: { type: 'text' },
        description: 'Outfit the character is wearing',
        table: {
            category: 'Data'
        }
    },
    color: {
        control: { type: 'object' },
        description: 'Color to present the chip',
        table: {
            category: 'Presentation'
        }
    }
  }
}

export default PureCharacterChipStory

const Template = (args) => <PureCharacterChip {...args} />

export const Default = Template.bind({})
Default.args = {
    Name: 'Tess',
    Pronouns: 'She/her',
    FirstImpression: 'Frumpy Goth',
    OneCoolThing: 'Fuchsia eyes',
    Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.',
    color: {
        primary: 'blue',
        light: 'lightblue'
    }
}

export const ExtremelyLongName = Template.bind({})
ExtremelyLongName.args = {
    Name: 'Celestia Alsace Vortaren von Ludenburg the First',
    Pronouns: 'She/her',
    FirstImpression: 'Frightening royalty',
    color: {
        primary: 'blue'
    }
}
