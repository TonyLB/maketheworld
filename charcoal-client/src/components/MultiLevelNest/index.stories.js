import React from 'react';

import { MultiLevelNest } from '.';

export default {
  title: 'MultiLevelNest',
  component: MultiLevelNest,
  argTypes: {
    currentLevel: {
        description: 'The level of nesting being currently shown',
        control: {
            type: 'select',
            options: [1, 2, 3]
        }
    },
    levelComponents: {
        description: 'A list of JSX components, indexed by what nesting level they display at'
    }
  }
};

const Template = (args) => <div style={{ position: 'relative', width: '400px', height: '300px' }}><MultiLevelNest {...args} /></div>

export const TwoLevels = Template.bind({})
TwoLevels.args = {
    levelComponents: [
        <div><h1>Level 1</h1></div>,
        <div style={{ backgroundColor: '#F0F0F0'}}><h1>Level 2</h1></div>
    ],
    currentLevel: 1
}

export const ThreeLevels = Template.bind({})
ThreeLevels.args = {
    levelComponents: [
        <div><h1>Level 1</h1></div>,
        <div style={{ backgroundColor: '#F0F0F0'}}><h1>Level 2</h1></div>,
        <div><h1>Level 3</h1></div>
    ],
    currentLevel: 1
}
