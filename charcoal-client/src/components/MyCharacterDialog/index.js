// Foundational imports (React, Redux, etc.)
import React, { useReducer } from 'react'
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
    Grid
} from '@material-ui/core'


// Local code imports
import { closeMyCharacterDialog } from '../../actions/UI/myCharacterDialog'
import { putMyCharacterAndCloseDialog } from '../../actions/characters'
import { getMyCharacterDialogUI } from '../../selectors/UI/myCharacterDialog.js'
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

const myCharacterDialogReducer = (state, action) => {
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

export const MyCharacterDialog = ({ nested=false }) => {
    const { open, nestedOpen, ...defaultValues } = useSelector(getMyCharacterDialogUI)
    const [formValues, formDispatch] = useReducer(myCharacterDialogReducer, {})
    const dispatch = useDispatch()

    const { name = '', pronouns = '', firstImpression = '', outfit = '', oneCoolThing = '' } = formValues

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const saveHandler = () => {
        const { name, pronouns, firstImpression, outfit, oneCoolThing, characterId } = formValues
        const characterData = { name, pronouns, firstImpression, outfit, oneCoolThing, characterId }
        dispatch(putMyCharacterAndCloseDialog(characterData))
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <Dialog
                maxWidth="lg"
                open={(nested ? nestedOpen : open) || false}
                onEnter={() => { formDispatch(resetFormValues(defaultValues)) } }
            >
                <DialogTitle id="character-dialog-title">Character Edit</DialogTitle>
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
                                                id="pronouns"
                                                required
                                                label="Pronouns"
                                                value={pronouns}
                                                onChange={onShallowChangeHandler('pronouns')}
                                            />
                                        </div>
                                        <div>
                                            <TextField
                                                required
                                                id="firstImpression"
                                                label="First Impression"
                                                value={firstImpression}
                                                onChange={onShallowChangeHandler('firstImpression')}
                                            />
                                            <TextField
                                                id="oneCoolThing"
                                                label="One Cool Thing"
                                                value={oneCoolThing}
                                                onChange={onShallowChangeHandler('oneCoolThing')}
                                            />

                                        </div>
                                        <div>
                                            <TextField
                                                id="outfit"
                                                label="Outfit"
                                                value={outfit}
                                                multiline
                                                rows={2}
                                                fullWidth
                                                onChange={onShallowChangeHandler('outfit')}
                                            />
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeMyCharacterDialog()) } }>
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

export default MyCharacterDialog