import React, { FunctionComponent, useState } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Button,
    TextField
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface WMLComponentHeaderProps {
    AssetId: string;
    type: 'Room' | 'Feature';
    onAdd?: (key: string) => void;
}

export const AddWMLComponent: FunctionComponent<WMLComponentHeaderProps> = ({ type, onAdd = () => { }}) => {
    const [key, setKey] = useState<string>('')
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    return <ListItemButton onClick={enteringKey ? () => {} : () => { setEnteringKey(true) }}>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        {
            (enteringKey === false) && <ListItemText primary={`Add ${type}`} />
        }
        {
            (enteringKey === true) &&
                <React.Fragment>
                    <TextField
                        required
                        id="component-key"
                        label="Key"
                        value={key}
                        onChange={(event) => {
                            setKey(event.target.value)
                        }}
                    />
                    <Button variant="contained" onClick={() => {
                        onAdd(key)
                        setEnteringKey(false)
                    } }>Add</Button>
                    <Button variant="outlined" onClick={() => { setEnteringKey(false) }}>Cancel</Button>
                </React.Fragment>
        }
    </ListItemButton>
}

export default AddWMLComponent
