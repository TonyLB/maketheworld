import React from 'react'

import {
    Typography,
    Card,
    Grid
} from '@material-ui/core'

export const WorldMessage = ({ message, ...rest }) => {
    return <React.Fragment {...rest} >
        <Card elevation={5}>
            <Grid container wrap="nowrap" spacing={2}>
                <Grid item>
                </Grid>
                <Grid item xs>
                    <Typography variant='body1' align='left'>
                        { message.message }
                    </Typography>
                </Grid>
            </Grid>
        </Card>
        <br />
    </React.Fragment>
}

export default WorldMessage