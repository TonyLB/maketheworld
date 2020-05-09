// Foundational imports (React, Redux, etc.)
import React, { useReducer, useState } from 'react'
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
    TextField,
    Grid,
    IconButton,
    Switch,
    Collapse
} from '@material-ui/core'
import NeighborhoodIcon from '@material-ui/icons/LocationCity'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'

// Local code imports
import { closeNeighborhoodDialog } from '../../actions/UI/neighborhoodDialog'
import { putAndCloseNeighborhoodDialog } from '../../actions/permanentAdmin'
import { getNeighborhoodDialogUI } from '../../selectors/UI/neighborhoodDialog.js'
import { getPermanentHeaders, getNeighborhoodOnlyTreeExcludingSubTree, getNeighborhoodPaths } from '../../selectors/permanentHeaders.js'
import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import PermanentSelectPopover from '../RoomDialog/PermanentSelectPopover'
import ExitList from '../ExitList'
import useStyles from '../styles'
import GrantTable from './GrantTable'

const RESET_FORM_VALUES = 'RESET_FORM_VALUES'
const resetFormValues = (defaultValues) => ({
    type: RESET_FORM_VALUES,
    defaultValues
})
const APPEARANCE_UPDATE = 'APPEARANCE_UPDATE'
const appearanceUpdate = ({ label, value }) => ({
    type: APPEARANCE_UPDATE,
    label,
    value
})

const GRANT_UPDATE = 'GRANT_UPDATE'
const grantUpdate = ({ CharacterId, Roles }) => ({
    type: GRANT_UPDATE,
    CharacterId,
    Roles
})

const GRANT_ADD = 'GRANT_ADD'
const grantAdd = (CharacterId) => ({
    type: GRANT_ADD,
    CharacterId
})

const GRANT_DELETE = 'GRANT_DELETE'
const grantDelete = (CharacterId) => ({
    type: GRANT_DELETE,
    CharacterId
})

const neighborhoodDialogReducer = (state, action) => {
    switch(action.type) {
        case APPEARANCE_UPDATE:
            return {
                ...state,
                [action.label]: action.value
            }
        case GRANT_UPDATE:
            return {
                ...state,
                grants: [
                    ...(state.grants.filter(({ CharacterId }) => (CharacterId !== action.CharacterId))),
                    {
                        CharacterId: action.CharacterId,
                        Roles: action.Roles.join(',')
                    }
                ]
            }
        case GRANT_ADD:
            return {
                ...state,
                grants: [
                    ...(state.grants || []),
                    {
                        CharacterId: action.CharacterId,
                        Roles: ''
                    }
                ]
            }
        case GRANT_DELETE:
            return {
                ...state,
                grants: (state.grants || []).filter(({ CharacterId }) => (CharacterId !== action.CharacterId))
            }
        case RESET_FORM_VALUES:
            return action.defaultValues
        default:
            return state
    }
}

export const NeighborhoodDialog = ({ nested=false }) => {
    const { open, nestedOpen, ...defaultValues } = useSelector(getNeighborhoodDialogUI)
    const permanentHeaders = useSelector(getPermanentHeaders)
    const { Grants: myGrants } = useSelector(getMyCurrentCharacter)
    const [formValues, formDispatch] = useReducer(neighborhoodDialogReducer, {})
    const { name = '', description = '', parentId = '', visibility = 'Visible' } = formValues
    const { Ancestry: parentAncestry = '', Name: parentName = '' } = (permanentHeaders && permanentHeaders[parentId]) || {}

    const subTreeToExclude = formValues.neighborhoodId ? [...(parentAncestry ? [parentAncestry] : []), formValues.neighborhoodId].join(":") : 'NO EXCLUSION'
    const neighborhoodTree = useSelector(getNeighborhoodOnlyTreeExcludingSubTree(subTreeToExclude))
    const [ parentSetAnchorEl, setParentSetAnchorEl ] = useState(null)
    const [ exitsOpen, setExitsOpen] = useState(false)
    const [ grantsOpen, setGrantsOpen] = useState(false)
    const dispatch = useDispatch()

    const { Exits = [], Entries = [] } = useSelector(getNeighborhoodPaths(formValues.neighborhoodId))
    const neighborhoodPaths = [
        ...(Exits.map((rest) => ({ type: 'EXIT', ...rest}))),
        ...(Entries.map((rest) => ({ type: 'ENTRY', ...rest})))
    ]

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const onGrantChangeHandler = (CharacterId) => (event) => { formDispatch(grantUpdate({ CharacterId, Roles: event.target.value })) }
    const onGrantAddHandler = (CharacterId) => () => { formDispatch(grantAdd(CharacterId))}
    const onGrantDeleteHandler = (CharacterId) => () => { formDispatch(grantDelete(CharacterId))}
    const saveHandler = () => {
        const { name, description, visibility, parentId, neighborhoodId, exits, entries, grants } = formValues
        const neighborhoodData = { name, description, visibility, parentId, neighborhoodId, grants, exits, entries }
        dispatch(putAndCloseNeighborhoodDialog(neighborhoodData))
    }
    const onSetParentHandler = (neighborhoodId) => () => {
        formDispatch(appearanceUpdate({ label: 'parentId', value: neighborhoodId }))
        setParentSetAnchorEl(null)
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <PermanentSelectPopover
                anchorEl={parentSetAnchorEl}
                open={Boolean(parentSetAnchorEl)}
                onClose={() => { setParentSetAnchorEl(null) }}
                neighborhoods={{
                    ROOT: {
                        permanentId: '',
                        name: "No parent"
                    },
                    ...neighborhoodTree
                }}
                selectableNeighborhoods
                addHandler={onSetParentHandler}
            />
            <Dialog
                maxWidth="lg"
                open={(nested ? nestedOpen : open) || false}
                onEnter={() => { formDispatch(resetFormValues(defaultValues)) } }
            >
                <DialogTitle id="neighborhood-dialog-title">Neighborhood Edit</DialogTitle>
                <DialogContent>
                    <Grid container>
                        <Grid item>
                            <Card className={classes.card} >
                                <CardHeader
                                    title="Appearance"
                                    className={classes.lightblue}
                                    titleTypographyProps={{ variant: "overline" }}
                                />
                                <CardContent>
                                    <form className={classes.root} noValidate autoComplete="off">
                                        <div>
                                            <TextField
                                                required
                                                id="name"
                                                label="Name"
                                                value={name}
                                                onChange={onShallowChangeHandler('name')}
                                            />
                                            <TextField
                                                disabled
                                                id="parent"
                                                label="Parent"
                                                value={parentName}
                                            />
                                            <IconButton onClick={(event) => { setParentSetAnchorEl(event.target) }}>
                                                <NeighborhoodIcon />
                                            </IconButton>
                                        </div>
                                        <div>
                                            <TextField
                                                required
                                                id="description"
                                                label="Description"
                                                value={description}
                                                multiline
                                                rows={3}
                                                fullWidth
                                                onChange={onShallowChangeHandler('description')}
                                            />
                                        </div>
                                        <div>
                                            Private <Switch
                                                checked={visibility === 'Public'}
                                                onChange={() => { formDispatch(appearanceUpdate({ label: 'visibility', value: visibility === 'Public' ? 'Private' : 'Public' })) }}
                                                color="primary"
                                            /> Public
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                            {
                                (neighborhoodPaths.length > 0) &&
                                    <Card className={classes.card} >
                                        <CardHeader
                                            title="Exits"
                                            className={classes.lightblue}
                                            titleTypographyProps={{ variant: "overline" }}
                                            onClick={() => { setExitsOpen(!exitsOpen)}}
                                            action={exitsOpen ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                        />
                                        <CardContent>
                                            <Collapse in={exitsOpen}>
                                                <ExitList
                                                    paths={neighborhoodPaths}
                                                    role="Neighborhood"
                                                />
                                            </Collapse>
                                        </CardContent>
                                    </Card>
                            }
                            {
                                (!formValues.neighborhoodId || myGrants[formValues.neighborhoodId].Moderate) &&
                                <Card className={classes.card} >
                                    <CardHeader
                                        title="Grant Permissions"
                                        className={classes.lightblue}
                                        titleTypographyProps={{ variant: "overline" }}
                                        onClick={() => { setGrantsOpen(!grantsOpen)}}
                                        action={grantsOpen ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                    />
                                    <CardContent>
                                        <Collapse in={grantsOpen}>
                                            <GrantTable
                                                grants={formValues.grants}
                                                changeHandler={onGrantChangeHandler}
                                                addHandler={onGrantAddHandler}
                                                deleteHandler={onGrantDeleteHandler}
                                            />
                                        </Collapse>
                                    </CardContent>
                                </Card>
                            }
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeNeighborhoodDialog()) } }>
                        Cancel
                    </Button>
                    <Button onClick={saveHandler}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default NeighborhoodDialog