import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import Box from '@material-ui/core/Box'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'

import { getCharacterEditDirty, getCharacterEditValues, setValue, saveCharacter } from '../../slices/characterEdit/ssmVersion'
import { CharacterEditKeys } from '../../slices/characterEdit'
import useStyles from '../styles'

type CharacterEditFormProps = {
    characterKey: string
}

const validAssetKey = (value: string): boolean => (
    Boolean(value.match(/^[\w\-_\d]+$/)) && value.toLowerCase() !== 'new'
)

export const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = ({ characterKey }) => {
    const classes = useStyles()
    const dispatch = useDispatch()
    // const localClasses = useCharacterEditFormStyles()

    const value = useSelector(getCharacterEditValues(characterKey))
    const dirty = useSelector(getCharacterEditDirty(characterKey))

    const updateLabel = (label: CharacterEditKeys) => (event: { target: { value: string }}) => {
        dispatch(setValue(characterKey)({ label, value: event.target.value }))
    }
    return <Box className={classes.homeContents}>
        <TextField
            required
            error={!validAssetKey(value.assetKey)}
            id="assetKey"
            label="Asset Key"
            value={value.assetKey}
            onChange={updateLabel('assetKey')}
            helperText={ !validAssetKey(value.assetKey) ? "Asset key may not be 'New' and may contain only letters, numbers, - and _" : undefined }
        />
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
        <Button
            variant="contained"
            disabled={!dirty}
            onClick={() => {
                //
                // TODO: Refactor Redux so that the store has Typescript constraints
                //
                dispatch(saveCharacter(value.assetKey))
            }}
        >
                Save
        </Button>
    </Box>
}

export default CharacterEditForm
