// Foundational imports (React, Redux, etc.)
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Card,
    CardHeader,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Tooltip,
    IconButton
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import {
    TreeView,
    TreeItem
} from '@material-ui/lab'
import CreateIcon from '@material-ui/icons/Create'
import NeighborhoodAddIcon from '@material-ui/icons/PlaylistAdd'
import RoomAddIcon from '@material-ui/icons/AddBox'
import HouseIcon from '@material-ui/icons/House'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'

// Local code imports
import { closeNeighborhoodDialog } from '../../actions/UI/neighborhoodDialog'
import { activateRoomDialog } from '../../actions/UI/roomDialog'
import { fetchAndOpenRoomDialog } from '../../actions/permanentAdmin'
import { getNeighborhoodDialogUI } from '../../selectors/UI/neighborhoodDialog.js'
import { getNeighborhoods } from '../../selectors/neighborhoods'
import useStyles from '../styles'

const useTreeItemStyles = makeStyles(theme => ({
    root: {
        color: theme.palette.text.secondary,
        '&:hover > $content': {
          backgroundColor: theme.palette.action.hover,
        },
      },
      content: {
        color: theme.palette.text.secondary,
        fontWeight: theme.typography.fontWeightMedium,
        '$expanded > &': {
          fontWeight: theme.typography.fontWeightRegular,
        },
      },
      expanded: {},
      label: {
        fontWeight: 'inherit',
        color: 'inherit',
      },
      labelRoot: {
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing(0.5, 0),
        fontSize: "24px"
      },
      labelIcon: {
        marginRight: theme.spacing(1),
      },
      labelText: {
        fontWeight: 'inherit',
        flexGrow: 1,
      },
      labelActions: {
          marginLeft: theme.spacing(2)
      }
}))

const OverviewTreeItem = ({ labelText, ActionIcons, ...rest }) => {
    const classes = useTreeItemStyles()

    return <TreeItem
        label={
        <div className={classes.labelRoot}>
            <Typography variant="body1" className={classes.labelText}>
                {labelText}
            </Typography>
            <Typography variant="h6" className={classes.labelActions} color="inherit">
                {ActionIcons}
            </Typography>
        </div>
        }
        classes={{
            root: classes.root,
            content: classes.content,
            label: classes.label,
        }}
        {...rest}
    />
}

const NeighborhoodTreeItem = ({ nodeId, name, ...rest }) => {
    const dispatch = useDispatch()
    return <OverviewTreeItem
        nodeId={nodeId}
        labelText={name}
        ActionIcons={<React.Fragment>
            <Tooltip title={"Add Neighborhood"}>
                <NeighborhoodAddIcon fontSize="inherit" />
            </Tooltip>
            <Tooltip title={"Add Room"}>
                <IconButton
                    aria-label="add room"
                    onClick={() => {
                        dispatch(closeNeighborhoodDialog())
                        dispatch(activateRoomDialog({
                            parentId: nodeId,
                            parentName: name
                        }))
                    }}
                >
                    <RoomAddIcon fontSize="inherit" />
                </IconButton>
            </Tooltip>
            <Tooltip title={"Edit Neighborhood"}>
                <CreateIcon fontSize="inherit" />
            </Tooltip>
        </React.Fragment>}
        {...rest}
    />
}

const RoomTreeItem = ({ nodeId, name, ...rest }) => {
    const dispatch = useDispatch()
    return <OverviewTreeItem
        nodeId={nodeId}
        labelText={name}
        ActionIcons={<Tooltip title={"Edit Room"}>
            <IconButton
                aria-label="edit room"
                onClick={() => {
                    dispatch(closeNeighborhoodDialog())
                    dispatch(fetchAndOpenRoomDialog(nodeId))
                }}
            >
                <CreateIcon fontSize="inherit" />
            </IconButton>
        </Tooltip>}
        {...rest}
    />
}

const NeighborhoodItem = ({ item }) => {
    const { type, permanentId, name, children } = item
    switch(type) {
        case 'ROOM':
            return <RoomTreeItem
                key={permanentId}
                nodeId={permanentId}
                name={name}
            />
        default:
            return <NeighborhoodTreeItem
                key={permanentId}
                nodeId={permanentId}
                name={name}
            >
                {
                    Object.values(children || {})
                        .map((item) => (<NeighborhoodItem key={item.permanentId} item={item} />))
                }
            </NeighborhoodTreeItem>
    }
}

export const NeighborhoodDialog = () => {
    const { open } = useSelector(getNeighborhoodDialogUI)
    const neighborhoods = useSelector(getNeighborhoods)
    const dispatch = useDispatch()

    const classes = useStyles()
    return(
        <Dialog
            maxWidth="lg"
            open={open}
        >
            <DialogTitle id="room-dialog-title">World Overview</DialogTitle>
            <DialogContent>
                <Card className={classes.card}>
                    <CardHeader
                        title="Neighborhoods and Rooms"
                        className={classes.lightblue}
                        titleTypographyProps={{ variant: "overline" }}
                    />
                    <CardContent>
                        <TreeView
                            className={classes.treeView}
                            defaultCollapseIcon={<ExpandMoreIcon />}
                            defaultExpandIcon={<ChevronRightIcon />}
                            defaultEndIcon={<HouseIcon />}
                        >
                            {
                                Object.values(neighborhoods)
                                    .map((item) => (<NeighborhoodItem key={item.permanentId} item={item} />))
                            }
                        </TreeView>
                    </CardContent>
                </Card>
            </DialogContent>
            <DialogActions>
                <Button onClick={ () => { dispatch(closeNeighborhoodDialog()) } }>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default NeighborhoodDialog