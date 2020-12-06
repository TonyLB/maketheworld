//
// ClientSettings lists the settings local to this specific web client, for the app
//

import React from 'react'
import PropTypes from "prop-types"

// MaterialUI imports
import {
    Select,
    MenuItem,
    FormGroup,
    FormControlLabel,
    Switch
} from '@material-ui/core'

import useStyles from '../styles'

const ClientSettings = ({ textEntryLines, showNeighborhoodHeaders, onTextEntryChange = () => {}, onShowNeighborhoodChange = () => {} }) => {
    const classes = useStyles()
    return <form className={classes.root} style={{ padding: '10px' }} noValidate autoComplete="off">
        <div className={classes.contextMessage}>
            You can specify the number of lines that you want to see in your text-entry box for in-play communications.
            This doesn't effect how much you can actually type (that is virtually unlimited), but it will let you see
            more or less of that text at a given time.  Adjust to your own balance of screen real-estate.
        </div>
        <div>
            <Select
                labelId="textEntrySize"
                id="textEntrySize"
                value={textEntryLines || 1}
                onChange={(event) => { onTextEntryChange(event.target.value) }}
            >
                <MenuItem value={1}>Poetry (one line)</MenuItem>
                <MenuItem value={2}>Prose (two lines)</MenuItem>
                <MenuItem value={4}>Epic (four lines)</MenuItem>
                <MenuItem value={8}>Indulgence (eight lines)</MenuItem>
            </Select>
        </div>
        <div className={classes.contextMessage}>
            You can choose whether to see a header in your in-play messages any time that you enter a new neighborhood,
            describing the neighborhood generally.
        </div>
        <div>
            <FormGroup row>
                <FormControlLabel
                    control={
                        <Switch
                            checked={showNeighborhoodHeaders}
                            onChange={ (event) => { onShowNeighborhoodChange(event.target.checked) } }
                            name="showNeighborhoodHeaders"
                            color="primary"
                        />
                    }
                    label="Show Neighborhoods on movement"
                />
            </FormGroup>
        </div>
    </form>

}

ClientSettings.propTypes = {
    textEntryLines: PropTypes.number,
    showNeighborhoodHeaders: PropTypes.bool,
    onTextEntryChange: PropTypes.func,
    onShowNeighborhoodChange: PropTypes.func
}

export default ClientSettings