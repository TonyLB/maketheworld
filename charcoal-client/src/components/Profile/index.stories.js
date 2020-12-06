import React from 'react';

import Profile from './index';

export default {
    title: 'Profile/Profile',
    component: Profile,
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
        textEntryLines: {
            control: {
                type: 'select',
                options: [1, 2, 4, 8]
            },
            table: {
                category: 'Data'
            }
        },
        showNeighborhoodHeaders: {
            control: {
                type: 'boolean'
            },
            table: {
                category: 'Data'
            }
        },
        onTextEntryChange: {
            defaultValue: null,
            control: { action: 'onTextEntryChange' },
            table: {
                category: 'Events'
            }
        },
        onShowNeighborhoodChange: {
            defaultValue: null,
            control: { action: 'onShowNeighborhoodChange' },
            table: {
                category: 'Events'
            }
        }
    }
};

const Template = (args) => <div style={{ position: 'relative', width: '400px', height: '800px' }}><Profile {...args} /></div>

export const Basic = Template.bind({})
Basic.args = {
    myCharacters: [{
            CharacterId: '1',
            Name: 'Tess',
            Pronouns: 'She/her',
            FirstImpression: 'Frumpy Goth',
            OneCoolThing: 'Fuchsia eyes',
            Outfit: 'A frock-coat lovingly kit-bashed from a black hoodie and patchily-dyed lace.',
            HomeId: 'ABC'
        },
        {
            CharacterId: '2',
            Name: 'Marco',
            Pronouns: 'He/him',
            FirstImpression: 'Earth boy',
            HomeId: 'DEF'
        }
    ],
    textEntryLines: 1,
    showNeighborhoodHeaders: false
}
