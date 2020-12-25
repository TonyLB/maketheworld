import React from 'react';

import Profile from './index';

const ProfileStory = {
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
            description: 'Web-client setting for number of text entry lines shown',
            table: {
                category: 'Data'
            }
        },
        showNeighborhoodHeaders: {
            control: {
                type: 'boolean'
            },
            description: 'Web-client setting for whether to display Neighborhood transition headers',
            table: {
                category: 'Data'
            }
        },
        onCharacterSavePromiseFactory: {
            defaultValue: null,
            description: 'Called when the characterEdit saves data',
            control: { action: 'characterSavePromiseFactory' },
            table: {
                category: 'Events'
            }
        },
        onTextEntryChange: {
            defaultValue: null,
            description: 'Called when the text entry control is changed',
            control: { action: 'onTextEntryChange' },
            table: {
                category: 'Events'
            }
        },
        onShowNeighborhoodChange: {
            defaultValue: null,
            description: 'Called when the show Neighborhood control is changed',
            control: { action: 'onShowNeighborhoodChange' },
            table: {
                category: 'Events'
            }
        }
    }
}

export default ProfileStory

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
    showNeighborhoodHeaders: false,
}
