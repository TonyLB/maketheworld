import React from 'react'
import { useSelector } from 'react-redux'

import {
    Typography,
    Card,
    Grid,
    Avatar,
    Tooltip,
} from '@material-ui/core'

import { getColorMap } from '../../selectors/colorMap.js'
import useStyles from '../styles'

export const PlayerMessage = ({ message, ...rest }) => {
    const name = message.name
    const colorMap = useSelector(getColorMap)
    const color = name && colorMap && colorMap[name]
    const classes = useStyles()
    return <React.Fragment {...rest} >
        <Card elevation={5} className={ color && classes[color.light] }>
            <Grid container wrap="nowrap" spacing={2}>
                <Grid item>
                    {
                        name && <div>
                            <Tooltip title={name}>
                                <Avatar className={color && classes[color.primary]}>
                                    { name[0].toUpperCase() }
                                </Avatar>
                            </Tooltip>
                        </div>
                    }
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

export default PlayerMessage