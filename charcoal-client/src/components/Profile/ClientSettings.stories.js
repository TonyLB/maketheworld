import React from 'react';

import ClientSettings from './ClientSettings';

const ClientSettingsStory = {
    title: 'Profile/ClientSettings',
    component: ClientSettings,
    argTypes: {
        textEntryLines: {
            description: 'Web-client setting for number of text entry lines shown',
            control: {
                type: 'select',
                options: [1, 2, 4, 8]
            }
        },
        showNeighborhoodHeaders: {
            description: 'Web-client setting for whether to display Neighborhood transition headers',
            control: {
                type: 'boolean'
            }
        },
        onTextEntryChange: {
            defaultValue: null,
            description: 'Called when the text entry control is changed',
            control: { action: 'onTextEntryChange' }
        },
        onShowNeighborhoodChange: {
            defaultValue: null,
            description: 'Called when the show Neighborhood control is changed',
            control: { action: 'onShowNeighborhoodChange' }
        }
    }
}

export default ClientSettingsStory

const Template = (args) => <ClientSettings {...args} />

export const Basic = Template.bind({})
Basic.args = {
    textEntryLines: 1,
    showNeighborhoodHeaders: false
}
