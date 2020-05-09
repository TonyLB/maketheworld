// Foundational imports (React, Redux, etc.)
import React, { useState } from 'react'

// MaterialUI imports
import {
    Popover,
    Card,
    CardHeader,
    CardContent,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Collapse
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import HouseIcon from '@material-ui/icons/House'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
// Local code imports
import useStyles from '../styles'

export const NeighborhoodListItem = ({
        type,
        name,
        permanentId,
        children,
        addHandler=()=>{},
        selectableNeighborhoods,
        ...rest
    }) => {
    const classes = useStyles()
    const [open, setOpen] = useState(false)

    if (type === 'ROOM') {
        return <ListItem
            button
            onClick={addHandler(permanentId, name)}
            {...rest}
        >
            <ListItemIcon>
                <HouseIcon />
            </ListItemIcon>
            <ListItemText primary={name} />
        </ListItem>
    }
    else {
        if (children) {
            return <React.Fragment>
                <ListItem
                    button
                    onClick={
                        selectableNeighborhoods
                            ? addHandler(permanentId, name)
                            : () => { setOpen(!open) }
                    }
                    { ...rest }
                >
                    <ListItemIcon onClick={(event) => {
                        setOpen(!open)
                        event.stopPropagation()
                    }}>
                        { open ? <ExpandMoreIcon /> : <ChevronRightIcon /> }
                    </ListItemIcon>
                    <ListItemText primary={name} />
                </ListItem>
                <Collapse in={open} timeout="auto">
                    <List component="div" disablePadding>
                        {
                            Object.entries(children)
                                .map(([key, { Type, Name, PermanentId, children }]) => (
                                    <NeighborhoodListItem
                                        key={key}
                                        type={Type}
                                        name={Name}
                                        permanentId={PermanentId}
                                        children={children}
                                        className={classes.nested}
                                        addHandler={addHandler}
                                        selectableNeighborhoods={selectableNeighborhoods}
                                    />
                                ))
                        }
                    </List>
                </Collapse>
            </React.Fragment>
        }
        else {
            return <ListItem
                    button
                    onClick={
                        selectableNeighborhoods
                            ? addHandler(permanentId, name)
                            : () => { }
                    }
                    { ...rest }
                >
                    <ListItemText primary={name} />
                </ListItem>
        }
    }
}

export const PermanentSelectPopover = ({ onClose, neighborhoods = {}, addHandler=()=>{}, selectableNeighborhoods = false, ...rest }) => {
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
                title={`Select ${selectableNeighborhoods ? "Neighborhood" : "Room"}`}
                className={classes.lightblue}
                action={<IconButton aria-label="close" onClick={onClose}>
                    <CloseIcon />
                </IconButton>}
                titleTypographyProps={{ variant: "overline" }}
            />
            <CardContent>
                <List component="div" disablePadding>
                    {
                        Object.entries(neighborhoods)
                        .map(([key, { Type, Name, PermanentId, children }]) => (
                            <NeighborhoodListItem
                                key={key}
                                type={Type}
                                name={Name}
                                permanentId={PermanentId}
                                children={children}
                                addHandler={addHandler}
                                selectableNeighborhoods={selectableNeighborhoods}
                            />
                        ))
                    }
                </List>
            </CardContent>
        </Card>
    </Popover>
}

export default PermanentSelectPopover