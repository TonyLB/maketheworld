import React from 'react'

import {
    Typography,
    Card,
    Grid,
    Avatar,
    Tooltip,
} from '@material-ui/core'
import HouseIcon from '@material-ui/icons/House'

import useStyles from '../styles'

export const RoomDescriptionMessage = ({ message, ...rest }) => {
    const classes = useStyles()
    return <React.Fragment {...rest} >
        <Card elevation={5} className={ classes.darkgreen }>
            <Grid container wrap="nowrap" spacing={2}>
                <Grid item>
                    <div>
                        <Tooltip title={message.name}>
                            <Avatar className={classes.darkgreen.primary}>
                                <HouseIcon />
                            </Avatar>
                        </Tooltip>
                    </div>
                </Grid>
                <Grid item xs>
                    <Typography variant='h5' align='left'>
                        { message.name }
                    </Typography>
                    <Typography variant='body1' align='left'>
                        { message.description }
                    </Typography>
                </Grid>
            </Grid>
        </Card>
        <br />
    </React.Fragment>
}

export default RoomDescriptionMessage