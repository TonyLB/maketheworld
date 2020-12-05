import React from 'react';

import { NonLinearStepper } from '.';

export default {
  title: 'NonLinearStepper',
  component: NonLinearStepper,
  argTypes: {
    steps: {
        description: 'A list of objects correspond to steps.  Each step-object consists of a label field, optional boolean, and a content JSX value',
        control: { type: 'array' }
    },
    completed: {
        description: 'An object keyed by indices into the steps list, recording True if that step has been completed'
    }
  }
};

const Template = (args) => <NonLinearStepper {...args} />

export const Basic = Template.bind({})
Basic.args = {
    steps: [
        {
          label: 'Name',
          content: 'Enter name here'
        },
        {
          label: 'Address (optional)',
          content: 'Enter address here',
          optional: true
        },
        {
          label: 'Interests',
          content: 'Enter interests here'
        }
    ],
    completed: {}
}

export const Completed = Template.bind({})
Completed.args = {
  ...Basic.args,
  completed: { 0: true, 1: true, 2: true }
}