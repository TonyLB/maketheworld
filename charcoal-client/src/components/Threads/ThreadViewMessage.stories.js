import React from 'react'

import {
    List
} from '@material-ui/core'

import { ThreadViewMessage } from './ThreadViewMessage'

const ThreadViewMessageStory = {
  title: 'Threads/ThreadViewMessage',
  component: ThreadViewMessage,
  argTypes: {
    Message: {
        control: { type: 'text' },
        description: 'Contents of message',
        table: {
            category: 'Data'
        }
    },
    MessageTime: {
        control: { type: 'number' },
        description: 'Epoch time (in milliseconds) of message',
        table: {
            category: 'Data'
        }
    },
    fromName: {
        control: { type: 'text' },
        description: 'Name of player who sent message',
        table: {
            category: 'Data'
        }
    },
    fromColor: {
        control: { type: 'text' },
        description: 'A color key for rendering the message',
        table: {
            category: 'Data'
        }
    },
    fromSelf: {
        control: { type: 'boolean' },
        description: 'True if the sender is the one viewing the message',
        table: {
            category: 'Data'
        }
    }
  }
}

export default ThreadViewMessageStory

const Template = (args) => <List><ThreadViewMessage {...args} /></List>

export const Default = Template.bind({})
Default.args = {
    Message: 'So what do we do about regularly scheduled events during festival time?  We don\'t want players feeling torn about what to attend.',
    MessageTime: 1608489657688,
    fromName: 'Marco',
    fromColor: 'green',
    fromSelf: false
}

export const LongMessage = Template.bind({})
LongMessage.args = {
    ...Default.args,
    Message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
}