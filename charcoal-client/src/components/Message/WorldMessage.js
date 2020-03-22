import React from 'react'

import {
    Typography,
    ListItem,
    ListItemText
} from '@material-ui/core'

export const WorldMessage = ({ message, ...rest }) => {
    return <ListItem alignItems="flex-start" {...rest} >
        <ListItemText>
            <Typography variant='body1' align='left'>
                { message.message }
            </Typography>
        </ListItemText>
    </ListItem>
}

export default WorldMessage