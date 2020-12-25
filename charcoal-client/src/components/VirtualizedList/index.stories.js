import React from 'react'
import ListItemText from '@material-ui/core/ListItemText'

import { VirtualizedList } from './index'

const VirtualizedListStory = {
  title: 'VirtualizedList',
  component: VirtualizedList,
  argTypes: {
    rowCount: {
        control: { type: 'number' },
        description: 'Number of rows currently supported by dataSelect function',
        table: {
            category: 'Data'
        }
    }
  }
}

export default VirtualizedListStory

const Template = (args) => <div style={{ position: "absolute", width: "300px", height: "400px" }}><div style={{ position: "relative", width: "300px", height: "400px" }}><VirtualizedList {...args} forceHeight={400} /></div></div>

export const Default = Template.bind({})
Default.args = {
    style: { },
    dataSelect: (index) => (<ListItemText primary={`Test ${index}`} />),
    rowCount: 100
}
