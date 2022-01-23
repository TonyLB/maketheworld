import React from 'react'

import {
    Typography,
    Card,
    CardHeader,
    CardContent,
    ListItem,
    ListItemText
} from '@mui/material'
import NewReleasesIcon from '@mui/icons-material/NewReleases'

import useStyles from '../styles'

export const AnnouncementMessage = React.forwardRef(({ Message, Title, Recap, ...rest }, ref) => {
    const classes = useStyles()
    return <ListItem ref={ref} alignItems="flex-start" {...rest} className={Recap ? classes.lightgrey : null}>
        <ListItemText inset>
            <Card>
                <CardHeader className={Recap ? classes.darkgrey : classes.lightgrey} avatar={<NewReleasesIcon />} title={Title} />
                <CardContent className={Recap ? classes.lightgrey : null }>
                    <Typography variant='body1' align='left'>
                        { Message }
                    </Typography>
                </CardContent>
            </Card>
        </ListItemText>
    </ListItem>
})

export default AnnouncementMessage