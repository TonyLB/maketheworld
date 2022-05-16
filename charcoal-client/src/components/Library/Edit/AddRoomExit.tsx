import React, { FunctionComponent, useState, useMemo } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Button,
    TextField
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useLibraryAsset } from './LibraryAsset'

interface AddRoomExitProps {
    onAdd?: (key: string) => void;
}

export const AddRoomExit: FunctionComponent<AddRoomExitProps> = ({ onAdd = () => { }}) => {
    const { normalForm } = useLibraryAsset()
    const [key, setKey] = useState<string>('')
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    const errorMessage = useMemo<string>(() => {
        if (key in normalForm) {
            return `"${key}" is already used in this asset`
        }
        if (key.length && (key.search(/^\w[\w\d\_]*$/) === -1)) {
            return `Keys must start with a letter and be made of up letters, digits, and the "_" character`
        }
        return ''
    }, [key, normalForm])
    const contents = <React.Fragment>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        {
            (enteringKey === false) && <ListItemText primary={`Add Exit`} />
        }
        {
            (enteringKey === true) &&
                <React.Fragment>
                    <TextField
                        required
                        id="component-key"
                        label="Key"
                        size="small"
                        value={key}
                        onChange={(event) => {
                            setKey(event.target.value)
                        }}
                        error={Boolean(errorMessage)}
                        helperText={errorMessage}
                    />
                    <Button disabled={Boolean(errorMessage) || (key.length === 0)} variant="contained" onClick={() => {
                        onAdd(key)
                        setEnteringKey(false)
                        setKey('')
                    } }>Add</Button>
                    <Button variant="outlined" onClick={() => { setEnteringKey(false) }}>Cancel</Button>
                </React.Fragment>
        }
    </React.Fragment>
    return enteringKey
        ? <ListItem>
            { contents }
        </ListItem>
        : <ListItemButton onClick={enteringKey ? () => {} : () => { setEnteringKey(true) }}>
            { contents }
        </ListItemButton>
}

export default AddRoomExit
