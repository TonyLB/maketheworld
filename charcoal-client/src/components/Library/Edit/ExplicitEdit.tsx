import React, { FunctionComponent, useEffect, useState } from "react"
import { IconButton, TextField } from "@mui/material"
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import ClearIcon from '@mui/icons-material/Clear'

export const ExplicitEdit: FunctionComponent<{ value: string; onChange: (value: string) => void; validate?: (value: string) => boolean; helperText?: string }> = ({ value, onChange, validate, helperText }) => {
    const [currentValue, setCurrentValue] = useState<string>(value)
    const [isValid, setIsValid] = useState<boolean>(true)
    useEffect(() => {
        setCurrentValue(value)
    }, [value])
    const [editing, setEditing] = useState<boolean>(false)
    return editing
        ? <React.Fragment>
                <TextField
                    size="small"
                    variant="standard"
                    value={currentValue}
                    error={!isValid}
                    helperText={!isValid && helperText}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        setCurrentValue(event.target.value)
                        if (validate && !validate(event.target.value)) {
                            setIsValid(false)
                        }
                        else {
                            setIsValid(true)
                        }
                    }}
                />
                <IconButton
                    size="small"
                    disabled={!isValid}
                    onClick={() => {    
                        if (isValid) {
                            onChange(currentValue)
                            setEditing(false)
                        }
                    } }
                >
                    <CheckIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                    size="small"
                    onClick={() => {
                        setEditing(false)
                        setCurrentValue(value)
                        setIsValid(true)
                    } }
                >
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