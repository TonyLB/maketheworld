//
// MyCharacters lists the characters assigned to the active player, with controls to edit, archive, and connect
//

import React from 'react'
import PropTypes from "prop-types"
import { v4 as uuidv4 } from 'uuid'

// MaterialUI imports
import {
    List
} from '@material-ui/core'
import MyCharacterListItem from './MyCharacterListItem'
import AddCharacterListItem from './AddCharacterListItem'

import useStyles from '../styles'

export const MyCharacters = ({ myCharacters = [], editCharacter = () => {}, connectCharacter = () => {} }) => {
    const classes = useStyles()
    return <List className={classes.characterSelectionList}>
        {
            myCharacters.map(({
                Name,
                CharacterId
            }, index) => (
                <MyCharacterListItem key={CharacterId || `Character-${index}`} Name={Name} CharacterId={CharacterId} onEdit={() => { editCharacter(CharacterId) }} onConnect={() => { connectCharacter(CharacterId) }} />
            ))
        }
        <AddCharacterListItem onEdit={() => { editCharacter(uuidv4()) }} />
    </List>

}

MyCharacters.propTypes = {
    myCharacters: PropTypes.arrayOf(PropTypes.shape({
        CharacterId: PropTypes.string,
        Name: PropTypes.string,
        Pronouns: PropTypes.string,
        FirstImpression: PropTypes.string,
        OneCoolThing: PropTypes.string,
        Outfit: PropTypes.string,
        HomeId: PropTypes.string
    })),
    editCharacter: PropTypes.func,
    connectCharacter: PropTypes.func
}

export default MyCharacters
