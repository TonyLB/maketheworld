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

import MultiLevelNest from '../MultiLevelNest'
import MyCharacters from './MyCharacters'
import EditPanel from './EditPanel'

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
                        <EditPanel
                            characterData={currentCharacter}
                            setCharacterId={setEditingCharacter}
                            navigateBack={() => { setEditingCharacter(null) }}
                        />
                    }
                </React.Fragment>
            ]}
            currentLevel={editingCharacter ? 2 : 1}
        />
    </div>
}

export default Profile
