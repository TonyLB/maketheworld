import React, { useState } from 'react'

import Button from '@material-ui/core/Button'

import CharacterEdit from './CharacterEdit'
import useStyles from '../styles'

export const EditPanel = ({ characterData, navigateBack, setCharacterId }) => {

    const classes = useStyles()
    const [{ dirty = false, valid = true }, setEditState] = useState({})

    return <React.Fragment>
        <CharacterEdit
            characterData={{
                characterId: characterData.CharacterId || '',
                name: characterData.Name || '',
                pronouns: characterData.Pronouns || '',
                firstImpression: characterData.FirstImpression || '',
                oneCoolThing: characterData.OneCoolThing || '',
                outfit: characterData.Outfit || ''
            }}
            setEditState={setEditState}
        />
        <div className={classes.actionsContainer}>
            <div>
                <Button
                    onClick={() => {
                        setCharacterId(null)
                        navigateBack()
                    }}
                    className={classes.button}
                >
                    Cancel
                </Button>
                <Button
                    disabled={!(dirty && valid)}
                    variant="contained"
                    color="primary"
                    onClick={() => {}}
                    className={classes.button}
                >
                    Save
                </Button>
            </div>
        </div>
    </React.Fragment>

}

export default EditPanel