// Foundational imports (React, Redux, etc.)
import React, { useReducer, useEffect } from 'react'
import { useDispatch } from 'react-redux'

// MaterialUI imports
import {
    TextField
} from '@material-ui/core'


// Local code imports
import { putMyCharacter } from '../../actions/characters'
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
            characterId: '',
            name: '',
            pronouns: '',
            firstImpression: '',
            outfit: '',
            oneCoolThing: '',
        },
        setEditState = () => {},
        closeEdit = () => {}
    }) => {
    const [formValues, formDispatch] = useReducer(myCharacterDialogReducer, {})
    const dispatch = useDispatch()

    const workingCharacterId = (formValues && formValues.characterId) || ''

    useEffect(() => {
        // console(`Working CharacterId: ${workingCharacterId}, Incoming: ${characterData.characterId}`)
        if (workingCharacterId !== characterData.characterId || (characterData.characterId && !workingCharacterId)) {
            formDispatch(resetFormValues(characterData))
        }
    }, [workingCharacterId, characterData.characterId])

    const { name = '', pronouns = '', firstImpression = '', outfit = '', oneCoolThing = '' } = formValues

    const completed = {
        0: Boolean(name) && Boolean(pronouns),
        1: Boolean(firstImpression),
        2: Boolean(outfit)
    }

    const onShallowChangeHandler = (label) => (event) => { formDispatch(appearanceUpdate({ label, value: event.target.value })) }
    const saveHandler = () => {
        const { name, pronouns, firstImpression, outfit, oneCoolThing, characterId, homeId } = formValues
        dispatch(putMyCharacter({ name, pronouns, firstImpression, outfit, oneCoolThing, characterId, homeId })).then(closeEdit)
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
                            </React.Fragment>
                        },
                        {
                            label: 'Impression',
                            content: <React.Fragment>
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
                            </React.Fragment>
                        },
                        {
                            label: 'Outfit',
                            content: <React.Fragment>
                                <TextField
                                    id="outfit"
                                    label="Outfit"
                                    value={outfit}
                                    multiline
                                    rows={2}
                                    fullWidth
                                    onChange={onShallowChangeHandler('outfit')}
                                />
                            </React.Fragment>
                        }
                    ]
                } />
            </form>
        </React.Fragment>
    )
}

export default CharacterEdit