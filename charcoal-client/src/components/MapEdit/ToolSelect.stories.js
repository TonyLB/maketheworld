import React from 'react';

import ToolSelect from './ToolSelect'

const ToolSelectStory = {
  title: 'MapEdit/ToolSelect',
  component: ToolSelect,
  argTypes: {
  }
}

export default ToolSelectStory

const Template = (args) => <ToolSelect {...args} />

export const Basic = Template.bind({})
Basic.args = {
}
