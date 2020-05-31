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
    FormControl,
    FormLabel,
    FormControlLabel,
    RadioGroup,
    Radio,
    Collapse,
    Portal,
    Snackbar
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import NeighborhoodIcon from '@material-ui/icons/LocationCity'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import ExpandLessIcon from '@material-ui/icons/ExpandLess'
import MapIcon from '@material-ui/icons/Explore'

// Local code imports
import { closeNeighborhoodDialog } from '../../actions/UI/neighborhoodDialog'
import { putAndCloseNeighborhoodDialog } from '../../actions/permanentAdmin'
import { getNeighborhoodDialogUI } from '../../selectors/UI/neighborhoodDialog.js'
import {
    getPermanentHeaders,
    getNeighborhoodOnlyTreeExcludingSubTree,
    getNeighborhoodPaths
} from '../../selectors/permanentHeaders.js'
import { getMaps } from '../../selectors/maps'
import { getNeighborhoodUpdateValidator } from '../../selectors/validators'
import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import PermanentSelectPopover from '../RoomDialog/PermanentSelectPopover'
import MapSelectPopover from '../Map/MapSelectPopover'
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

const neighborhoodDialogReducer = (validator) => (state, action) => {
    let returnVal = state
    switch(action.type) {
        case APPEARANCE_UPDATE:
            returnVal = {
                ...state,
                [action.label]: action.value
            }
            break
        case GRANT_UPDATE:
            returnVal = {
                ...state,
                grants: [
                    ...(state.grants.filter(({ CharacterId }) => (CharacterId !== action.CharacterId))),
                    {
                        CharacterId: action.CharacterId,
                        Roles: action.Roles.join(',')
                    }
                ]
            }
            break
        case GRANT_ADD:
            returnVal = {
                ...state,
                grants: [
                    ...(state.grants || []),
                    {
                        CharacterId: action.CharacterId,
                        Roles: ''
                    }
                ]
            }
            break
        case GRANT_DELETE:
            returnVal = {
                ...state,
                grants: (state.grants || []).filter(({ CharacterId }) => (CharacterId !== action.CharacterId))
            }
            break
        case RESET_FORM_VALUES:
            returnVal = action.defaultValues
            break
        default:
    }
    const { neighborhoodId: PermanentId, parentId: ParentId = '', visibility: Visibility, topology: Topology } = returnVal
    const validation = validator({ PermanentId, ParentId, Visibility, Topology }) || {}
    return {
        ...returnVal,
        error: validation.error
    }
}

export const NeighborhoodDialog = ({ nested=false }) => {
    const { open, nestedOpen, ...defaultValues } = useSelector(getNeighborhoodDialogUI)
    const permanentHeaders = useSelector(getPermanentHeaders)
    const maps = useSelector(getMaps)
    const { Grants: myGrants } = useSelector(getMyCurrentCharacter)
    const updateValidator = useSelector(getNeighborhoodUpdateValidator)
    const [formValues, formDispatch] = useReducer(neighborhoodDialogReducer(updateValidator), {})
    const { name = '', description = '', parentId = '', visibility = 'Visible', topology = 'Dead-End', error = '', neighborhoodId, mapId } = formValues
    const { Ancestry: parentAncestry = '', Name: parentName = '' } = (permanentHeaders && permanentHeaders[parentId]) || {}
    const { Name: mapName = '' } = (maps && mapId && maps[mapId]) || {}

    const subTreeToExclude = formValues.neighborhoodId ? [...(parentAncestry ? [parentAncestry] : []), formValues.neighborhoodId].join(":") : 'NO EXCLUSION'
    const neighborhoodTree = useSelector(getNeighborhoodOnlyTreeExcludingSubTree(subTreeToExclude))
    const [ parentSetAnchorEl, setParentSetAnchorEl ] = useState(null)
    const [ mapSetAnchorEl, setMapSetAnchorEl ] = useState(null)
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
        const { name, description, visibility, topology, parentId, neighborhoodId, mapId, exits, entries, grants } = formValues
        const neighborhoodData = { name, description, visibility, topology, parentId, neighborhoodId, mapId, grants, exits, entries }
        dispatch(putAndCloseNeighborhoodDialog(neighborhoodData))
    }
    const onSetParentHandler = (neighborhoodId) => () => {
        formDispatch(appearanceUpdate({ label: 'parentId', value: neighborhoodId }))
        setParentSetAnchorEl(null)
    }

    const onSetMapHandler = (mapId) => () => {
        formDispatch(appearanceUpdate({ label: 'mapId', value: mapId }))
        setMapSetAnchorEl(null)
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <Portal>
                <Snackbar open={Boolean(error)}>
                    <Alert severity="error">{error}</Alert>
                </Snackbar>
            </Portal>
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
            <MapSelectPopover
                anchorEl={mapSetAnchorEl}
                open={Boolean(mapSetAnchorEl)}
                onClose={() => { setMapSetAnchorEl(null) }}
                NeighborhoodId={neighborhoodId}
                addHandler={onSetMapHandler}
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
                                            <TextField
                                                disabled
                                                id="contextMap"
                                                label="Context Map"
                                                value={mapName}
                                            />
                                            <IconButton onClick={(event) => { setMapSetAnchorEl(event.target) }}>
                                                <MapIcon />
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
                                            <FormControl component="fieldset">
                                                <FormLabel component="legend">Visibility</FormLabel>
                                                <RadioGroup
                                                    aria-label="visibility"
                                                    name="visibility"
                                                    value={visibility}
                                                    onChange={(event) => {
                                                        formDispatch(appearanceUpdate({
                                                            label: 'visibility',
                                                            value: event.target.value
                                                        }))
                                                    }}
                                                >
                                                    <FormControlLabel value="Private" control={<Radio color="primary" />} label="Private" />
                                                    <FormControlLabel value="Public" control={<Radio color="primary" />} label="Public" />
                                                </RadioGroup>
                                            </FormControl>
                                            <FormControl component="fieldset">
                                                <FormLabel component="legend">Topology</FormLabel>
                                                <RadioGroup
                                                    aria-label="topology"
                                                    name="topology"
                                                    value={topology}
                                                    onChange={(event) => {
                                                        formDispatch(appearanceUpdate({
                                                            label: 'topology',
                                                            value: event.target.value
                                                        }))
                                                    }}
                                                >
                                                    <FormControlLabel value="Dead-End" control={<Radio color="primary" />} label="Dead-End" />
                                                    <FormControlLabel value="Connected" control={<Radio color="primary" />} label="Connected" />
                                                </RadioGroup>
                                            </FormControl>
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
                    <Button onClick={saveHandler} disabled={Boolean(error)}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default NeighborhoodDialog