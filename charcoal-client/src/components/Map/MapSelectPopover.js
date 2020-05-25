// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useSelector } from 'react-redux'

// MaterialUI imports
import {
    Popover,
    Card,
    CardHeader,
    CardContent,
    IconButton,
    List,
    ListItem,
    ListItemText
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

// Local code imports

import { getMaps } from '../../selectors/maps'
import { getPermanentHeaders }from '../../selectors/permanentHeaders'
import useStyles from '../styles'

export const MapSelectPopover = ({ onClose, NeighborhoodId = '', addHandler=()=>{}, ...rest }) => {
    const permanentHeaders = useSelector(getPermanentHeaders)
    const maps = useSelector(getMaps)
    const baseAncestry = permanentHeaders[NeighborhoodId].Ancestry || ''
    const mapsIncludingNeighborhoodId = [
        {
            MapId: null,
            Name: "No parent"
        },
        ...((
                NeighborhoodId &&
                Object.values(maps)
                    .filter(({ Rooms = {} }) => (Object.values(Rooms)
                        .find(({ PermanentId }) => ((permanentHeaders[PermanentId].Ancestry || '').startsWith(baseAncestry)))
                        ))
            ) || []
        )
    ]
    const classes = useStyles()
    return <Popover
        anchorOrigin={{
            vertical: 'center',
            horizontal: 'right',
        }}
        transformOrigin={{
            vertical: 'center',
            horizontal: 'left',
        }}
        onClose={onClose}
        { ...rest }
    >
        <Card>
            <CardHeader
                title={`Select Map`}
                className={classes.lightblue}
                action={<IconButton aria-label="close" onClick={onClose}>
                    <CloseIcon />
                </IconButton>}
                titleTypographyProps={{ variant: "overline" }}
            />
            <CardContent>
                <List component="div" disablePadding>
                    {
                        mapsIncludingNeighborhoodId
                            .map(({ Name, MapId }) => (
                                <ListItem button key={MapId} onClick={addHandler(MapId)}>
                                    <ListItemText>{Name}</ListItemText>
                                </ListItem>
                            ))
                    }
                </List>
            </CardContent>
        </Card>
    </Popover>
}

export default MapSelectPopover