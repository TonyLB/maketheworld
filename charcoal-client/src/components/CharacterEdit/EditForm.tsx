import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import Box from '@material-ui/core/Box'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import { makeStyles } from "@material-ui/core/styles"

import { characterEditById } from '../../selectors/characterEdit'
import { setValue, CharacterEditKeys, CharacterEditRecord } from '../../slices/characterEdit'
import { saveCharacter } from '../../actions/UI/characterEdit'
import useStyles from '../styles'

const useCharacterEditFormStyles = makeStyles((theme) => ({
    table: {
        
    }
}))

type CharacterEditFormProps = {
    characterId: string
}

const validAssetKey = (value: string): boolean => (
    Boolean(value.match(/^[\w\-\_\d]+$/))
)

//
// TODO: Create a general JS-Object to WML converter
//
const characterWML = (value: CharacterEditRecord['value']): string => {
    return [
        `<Character key="${value.assetKey}" fileName="${value.assetKey}">`,
        `\t<Name>${value.Name}</Name>`,
        `\t<Pronouns>${value.Pronouns}</Pronouns>`,
        ...(value.FirstImpression ? [`\t<FirstImpression>${value.FirstImpression}</FirstImpression>`]: []),
        ...(value.OneCoolThing ? [`\t<OneCoolThing>${value.OneCoolThing}</OneCoolThing>`]: []),
        ...(value.Outfit ? [`\t<Outfit>${value.Outfit}</Outfit>`]: []),
        '</Character>'
    ].join('\n')
}

export const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = ({ characterId }) => {
    const classes = useStyles()
    const localClasses = useCharacterEditFormStyles()

    const characterEditState = useSelector(characterEditById(characterId))
    const { value } = characterEditState
    const dispatch = useDispatch()
    const updateLabel = (label: CharacterEditKeys) => (event: { target: { value: string }}) => { dispatch(setValue({ characterId, label, value: event.target.value })) }
    return <Box className={classes.homeContents}>
        <TextField
            required
            error={!validAssetKey(value.assetKey || '')}
            id="assetKey"
            label="Asset Key"
            value={value.assetKey}
            onChange={updateLabel('assetKey')}
            helperText="Asset key may contain only letters, numbers, - and _"
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
            onClick={() => {
                //
                // TODO: Refactor Redux so that the store has Typescript constraints
                //
                (dispatch as any)(saveCharacter(characterEditState, characterWML(value)))
                    .then((url: string) => {
                        alert(url)
                    })
            }}
        >
                Save
        </Button>
    </Box>
}

export default CharacterEditForm
