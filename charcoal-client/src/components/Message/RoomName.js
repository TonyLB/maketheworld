import React from 'react'

import Typography from '@material-ui/core/Typography'

export const RoomDescription = ({ children }) => <React.Fragment>
    <Typography variant='h5' align='left'>
        { children }
    </Typography>
</React.Fragment>

export default RoomDescription