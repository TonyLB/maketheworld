import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import Box from '@material-ui/core/Box'
import TextField from '@material-ui/core/TextField'
import { makeStyles } from "@material-ui/core/styles"

import { characterEditById } from '../../selectors/characterEdit'
import { setValue, CharacterEditKeys } from '../../slices/characterEdit'
import useStyles from '../styles'

const useCharacterEditFormStyles = makeStyles((theme) => ({
    table: {
        
    }
}))

type CharacterEditFormProps = {
    characterId: string
}

export const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = ({ characterId }) => {
    const classes = useStyles()
    const localClasses = useCharacterEditFormStyles()

    const { value } = useSelector(characterEditById(characterId))
    const dispatch = useDispatch()
    const updateLabel = (label: CharacterEditKeys) => (event: { target: { value: string }}) => { dispatch(setValue({ characterId, label, value: event.target.value })) }
    return <Box className={classes.homeContents}>
        <TextField
            required
            id="name"
            label="Name"
            value={value.Name}
            onChange={updateLabel('Name')}
        />
        <TextField
            required
            id="pronouns"
            label="Pronouns"
            value={value.Pronouns}
            onChange={updateLabel('Pronouns')}
        />
        <TextField
            id="firstImpression"
            label="First Impression"
            value={value.FirstImpression}
            onChange={updateLabel('FirstImpression')}
        />
        <TextField
            id="oneCoolThing"
            label="One Cool Thing"
            value={value.OneCoolThing}
            onChange={updateLabel('OneCoolThing')}
        />
        <TextField
            id="outfit"
            label="Outfit"
            value={value.Outfit}
            onChange={updateLabel('Outfit')}
        />
    </Box>
}

export default CharacterEditForm
