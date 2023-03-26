import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

import { getCharacterEditDirty, getCharacterEditValues, setValue, saveCharacter } from '../../slices/UI/characterEdit'
import { CharacterEditKeys } from '../../slices/UI/characterEdit/baseClasses'

type CharacterEditFormProps = {
    characterKey: string
}

const validAssetKey = (value: string): boolean => (
    Boolean(value.match(/^[\w\-_\d]+$/)) && value.toLowerCase() !== 'new'
)

export const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = ({ characterKey }) => {
    const dispatch = useDispatch()
    // const localClasses = useCharacterEditFormStyles()

    const value: any = useSelector(getCharacterEditValues(characterKey)) || {}
    const dirty = useSelector(getCharacterEditDirty(characterKey))

    const updateLabel = (label: CharacterEditKeys) => (event: { target: { value: string }}) => {
        dispatch(setValue(characterKey)({ label, value: event.target.value }))
    }
    return <Box sx={{ flexGrow: 1, padding: 2 }}>
        <TextField
            required
            error={!validAssetKey(value.assetKey || '')}
            id="assetKey"
            label="Asset Key"
            value={value.assetKey}
            onChange={updateLabel('assetKey')}
            helperText={ !validAssetKey(value.assetKey || '') ? "Asset key may not be 'New' and may contain only letters, numbers, - and _" : undefined }
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
