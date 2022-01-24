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

export const AnnouncementMessage = React.forwardRef(({ Message, Title, Recap, ...rest }, ref) => {
    return <ListItem ref={ref} alignItems="flex-start" {...rest} sx={{ bgcolor: Recap ? 'grey' : undefined }}>
        <ListItemText inset>
            <Card>
                <CardHeader sx={{ bgcolor: Recap ? 'grey' : 'darkgrey' }} avatar={<NewReleasesIcon />} title={Title} />
                <CardContent sx={{ bgcolor: Recap ? 'grey' : undefined }}>
                    <Typography variant='body1' align='left'>
                        { Message }
                    </Typography>
                </CardContent>
            </Card>
        </ListItemText>
    </ListItem>
})

export default AnnouncementMessage