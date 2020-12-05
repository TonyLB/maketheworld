// Foundational imports (React, Redux, etc.)
import React, { useState, useReducer, useEffect } from 'react'
import PropTypes from 'prop-types'

// MaterialUI imports
import {
    TextField,
    Button
} from '@material-ui/core'


// Local code imports
import NonLinearStepper from '../NonLinearStepper'
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

export const CharacterEdit = ({
        characterData = {
            CharacterId: '',
            Name: '',
            Pronouns: '',
            FirstImpression: '',
            Outfit: '',
            OneCoolThing: '',
            HomeId: ''
        },
        savePromiseFactory = () => (Promise.resolve()),
        closeEdit = () => {}
    }) => {
    const [formValues, formDispatch] = useReducer(myCharacterDialogReducer, {})

    const workingCharacterId = (formValues && formValues.characterId) || ''

    const [dirty, setDirty] = useState(false)
    useEffect(() => {
        if (workingCharacterId !== characterData.CharacterId || (characterData.CharacterId && !workingCharacterId)) {
            setDirty(false)
            formDispatch(resetFormValues(characterData))
        }
    }, [workingCharacterId, characterData, setDirty])

    const { Name = '', Pronouns = '', FirstImpression = '', Outfit = '', OneCoolThing = '' } = formValues

    const completed = {
        0: Boolean(Name) && Boolean(Pronouns),
        1: Boolean(FirstImpression),
        2: Boolean(Outfit)
    }

    const onShallowChangeHandler = (label) => (event) => {
        setDirty(true)
        formDispatch(appearanceUpdate({ label, value: event.target.value }))
    }
    const saveHandler = () => {
        const { Name: name, Pronouns: pronouns, FirstImpression: firstImpression, Outfit: outfit, OneCoolThing: oneCoolThing, CharacterId: characterId, HomeId: homeId } = formValues
        savePromiseFactory({ name, pronouns, firstImpression, outfit, oneCoolThing, characterId, homeId }).then(closeEdit)
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <form className={classes.root} noValidate autoComplete="off">
                <NonLinearStepper 
                    completed={completed}
                    steps={
                    [
                        {
                            label: 'Name and Pronouns',
                            content: <React.Fragment>
                                <TextField
                                    required
                                    id="name"
                                    label="Name"
                                    value={Name}
                                    onChange={onShallowChangeHandler('Name')}
                                />
                                <TextField
                                    id="pronouns"
                                    required
                                    label="Pronouns"
                                    value={Pronouns}
                                    onChange={onShallowChangeHandler('Pronouns')}
                                />
                            </React.Fragment>
                        },
                        {
                            label: 'Impression',
                            content: <React.Fragment>
                                <TextField
                                    required
                                    id="firstImpression"
                                    label="First Impression"
                                    value={FirstImpression}
                                    onChange={onShallowChangeHandler('FirstImpression')}
                                />
                                <TextField
                                    id="oneCoolThing"
                                    label="One Cool Thing"
                                    value={OneCoolThing}
                                    onChange={onShallowChangeHandler('OneCoolThing')}
                                />
                            </React.Fragment>
                        },
                        {
                            label: 'Outfit',
                            content: <React.Fragment>
                                <TextField
                                    id="outfit"
                                    label="Outfit"
                                    value={Outfit}
                                    multiline
                                    rows={2}
                                    fullWidth
                                    onChange={onShallowChangeHandler('Outfit')}
                                />
                            </React.Fragment>
                        }
                    ]
                } />
                <Button variant="contained" onClick={closeEdit} className={[classes.button, classes.formButton].join(' ')}>Cancel</Button>
                <Button variant="contained" onClick={saveHandler} color="primary" className={[classes.button, classes.formButton].join(' ')} disabled={!(dirty && Boolean(Name) && Boolean(Pronouns) && Boolean(FirstImpression))}>Save</Button>
            </form>
        </React.Fragment>
    )
}

CharacterEdit.propTypes = {
    characterData: PropTypes.shape({
        CharacterId: PropTypes.string,
        Name: PropTypes.string,
        Pronouns: PropTypes.string,
        FirstImpression: PropTypes.string,
        OneCoolThing: PropTypes.string,
        Outfit: PropTypes.string,
        HomeId: PropTypes.string
    }),
    savePromiseFactory: PropTypes.func,
    closeEdit: PropTypes.func
}

export default CharacterEdit