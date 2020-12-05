//
// Profile shows information about the player, and their characters, and allows them
// to edit that information.
//

//
// DEPENDENCY:  Create the MultiLevelNesting component, and use it to nest a CharacterEditor
// to the right of the character listing (with player-specific information below the character
// listing on the left-most panel)
//

//
// Refactor AllCharactersDialog and MyCharacterDialog in order to get the form-editing
// functionality.
//

import React, { useState } from 'react'
import PropTypes from 'prop-types'

import MultiLevelNest from '../MultiLevelNest'
import MyCharacters from './MyCharacters'
import CharacterEdit from './CharacterEdit'

import useStyles from '../styles'

export const Profile = ({ myCharacters = [] }) => {
    const classes = useStyles()

    // const [showArchived, setShowArchived] = useState(false)
    const [editingCharacter, setEditingCharacter] = useState(null)
    const currentCharacter = myCharacters.find(({ CharacterId }) => (CharacterId === editingCharacter)) || {}
    return <div className={classes.profileContents}>
        <MultiLevelNest
            levelComponents={[
                <React.Fragment key="characterList">
                    <h1>My Characters</h1>
                    <MyCharacters
                        myCharacters={myCharacters}
                        editCharacter={setEditingCharacter}
                    />
                </React.Fragment>,
                <React.Fragment key="characterEdit">
                    { editingCharacter && 
                        <CharacterEdit
                            characterData={currentCharacter}
                            closeEdit={() => { setEditingCharacter(null) }}
                        />
                    }
                </React.Fragment>
            ]}
            currentLevel={editingCharacter ? 2 : 1}
        />
    </div>
}

Profile.propTypes = {
    myCharacters: PropTypes.arrayOf(PropTypes.shape({
        CharacterId: PropTypes.string,
        Name: PropTypes.string,
        Pronouns: PropTypes.string,
        FirstImpression: PropTypes.string,
        OneCoolThing: PropTypes.string,
        Outfit: PropTypes.string,
        HomeId: PropTypes.string
    }))
}

export default Profile
