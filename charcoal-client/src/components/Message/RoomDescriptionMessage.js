import React from 'react'

import { useSelector } from 'react-redux'

import {
    Typography,
    Grid,
    Chip,
    Divider,
    ListItem,
    ListItemText,
    ListItemIcon
} from '@material-ui/core'
import HouseIcon from '@material-ui/icons/House'

import useStyles from '../styles'

import { getColorMap } from '../../selectors/colorMap.js'

export const RoomDescriptionMessage = ({ message, ...rest }) => {
    const colorMap = useSelector(getColorMap)
    const classes = useStyles()
    const { name='', exits=[], players=[], description='' } = message
    return <ListItem className={ classes.roomMessage } alignItems="flex-start" {...rest} >
        <ListItemIcon>
            <HouseIcon />
        </ListItemIcon>
        <ListItemText>
            <Typography variant='h5' align='left'>
                { name }
            </Typography>
            <Typography variant='body1' align='left'>
                { description }
            </Typography>
            <Divider />
            <Grid container>
                <Grid item md>
                    <Typography variant='subtitle1' align='center'>
                        Exits:
                    </Typography>
                    { exits.map((exit) => (
                        <Chip
                            key={exit.exitName}
                            label={exit.exitName}
                        />
                    ))}
                </Grid>
                <Grid item md>
                    <Typography variant='subtitle1' align='center'>
                        Players:
                    </Typography>
                    { players
                        .map(({ name }) => name)
                        .map((player) => {
                            const color = colorMap[player]
                            console.log(`Chip color: ${color}`)
                            return <Chip
                                key={player}
                                label={player}
                                classes={{
                                    root: classes[`chip-${color.primary}`]
                                }}
                            />
                        })
                    }
                </Grid>
            </Grid>
        </ListItemText>
    </ListItem>
}

export default RoomDescriptionMessage