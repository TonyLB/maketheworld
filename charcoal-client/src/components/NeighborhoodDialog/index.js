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
    Switch
} from '@material-ui/core'
import NeighborhoodIcon from '@material-ui/icons/LocationCity'


// Local code imports
import { closeNeighborhoodDialog } from '../../actions/UI/neighborhoodDialog'
import { putAndCloseNeighborhoodDialog } from '../../actions/permanentAdmin'
import { getNeighborhoodDialogUI } from '../../selectors/UI/neighborhoodDialog.js'
import { getPermanentHeaders, getNeighborhoodOnlyTreeExcludingSubTree } from '../../selectors/permanentHeaders.js'
import PermanentSelectPopover from '../RoomDialog/PermanentSelectPopover'
import useStyles from '../styles'

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

const neighborhoodDialogReducer = (state, action) => {
    switch(action.type) {
        case APPEARANCE_UPDATE:
            return {
                ...state,
                [action.label]: action.value
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
    const [formValues, formDispatch] = useReducer(neighborhoodDialogReducer, {})
    const { name = '', description = '', parentId = '', visibility = 'Visible' } = formValues
    const { ancestry: parentAncestry = '', name: parentName = '' } = (permanentHeaders && permanentHeaders[parentId]) || {}

    const subTreeToExclude = formValues.neighborhoodId ? [...(parentAncestry ? [parentAncestry] : []), formValues.neighborhoodId].join(":") : 'NO EXCLUSION'
    const neighborhoodTree = useSelector(getNeighborhoodOnlyTreeExcludingSubTree(subTreeToExclude))
    const [ parentSetAnchorEl, setParentSetAnchorEl ] = useState(null)
    const dispatch = useDispatch()


    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const saveHandler = () => {
        const { name, description, visibility, parentId, neighborhoodId, exits, entries } = formValues
        const neighborhoodData = { name, description, visibility, parentId, neighborhoodId, exits, entries }
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
                                            Visible <Switch
                                                checked={visibility === 'Hidden'}
                                                onChange={() => { formDispatch(appearanceUpdate({ label: 'visibility', value: visibility === 'Hidden' ? 'Visible' : 'Hidden' })) }}
                                                color="primary"
                                            /> Hidden
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
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