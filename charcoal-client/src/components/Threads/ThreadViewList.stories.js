import React from 'react'

import { ThreadViewList } from './ThreadViewList'

const ThreadViewListStory = {
  title: 'Threads/ThreadViewList',
  component: ThreadViewList,
  argTypes: {
    Messages: {
        control: { type: 'array' },
        description: 'List of messages',
        table: {
            category: 'Data'
        }
    },
    viewAsCharacterId: {
        control: { type: 'text' },
        description: 'Character ID to distinguish as yourself in message display',
        table: {
            category: 'Data'
        }
    }
  }
}

export default ThreadViewListStory

const Template = (args) => <ThreadViewList {...args} />

export const Default = Template.bind({})
Default.args = {
    viewAsCharacterId: 'TESS',
    Messages: [
        {
            Message: 'So what do we do about regularly scheduled events during festival time?  We don\'t want players feeling torn about what to attend.',
            MessageTime: 1608489657688,
            FromCharacterId: 'MARCO',
            fromName: 'Marco',
            fromColor: 'green'
        },
        {
            Message: 'Shouldn\'t the organizers of the regular events be doing something special anyway?  Like, releasing classes to go to the festival, or something?',
            MessageTime: 1608489757688,
            FromCharacterId: 'TESS',
            fromName: 'Tess',
            fromColor: 'blue'
        }
    ]
}
