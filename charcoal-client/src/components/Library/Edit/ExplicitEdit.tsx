import React, { FunctionComponent, useEffect, useState } from "react"
import { IconButton, TextField } from "@mui/material"
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import ClearIcon from '@mui/icons-material/Clear'

export const ExplicitEdit: FunctionComponent<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const [currentValue, setCurrentValue] = useState<string>(value)
    useEffect(() => {
        setCurrentValue(value)
    }, [value])
    const [editing, setEditing] = useState<boolean>(false)
    return editing
        ? <React.Fragment>
                <TextField
                    label="Key"
                    size="small"
                    variant="standard"
                    value={currentValue}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        setCurrentValue(event.target.value);
                    }}
                />
                <IconButton
                    size="small"
                    onClick={() => {
                        onChange(value)
                        setEditing(false)
                    } }
                >
                    <CheckIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" onClick={() => { setEditing(false) } }>
                    <ClearIcon fontSize="inherit" />
                </IconButton>
            </React.Fragment>
        : <React.Fragment>
                { value }
                <IconButton size="small" onClick={() => { setEditing(true) } }>
                    <EditIcon fontSize="inherit" />
                </IconButton>
            </React.Fragment>
}

export default ExplicitEdit