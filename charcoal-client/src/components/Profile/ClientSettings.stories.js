import React from 'react';

import ClientSettings from './ClientSettings';

export default {
    title: 'Profile/ClientSettings',
    component: ClientSettings,
    argTypes: {
        textEntryLines: {
            control: {
                type: 'select',
                options: [1, 2, 4, 8]
            }
        },
        showNeighborhoodHeaders: 'boolean',
        onTextEntryChange: {
            defaultValue: null,
            control: { action: 'onTextEntryChange' }
        },
        onShowNeighborhoodChange: {
            defaultValue: null,
            control: { action: 'onShowNeighborhoodChange' }
        }
    }
};

const Template = (args) => <ClientSettings {...args} />

export const Basic = Template.bind({})
Basic.args = {
    textEntryLines: 1,
    showNeighborhoodHeaders: false
}
