//
// PureCharacterChip shows a small nameplate for a character, with a tooltip summarizing
// their details.  It accepts all needed data (no recourse to context or redux)
//

import React from 'react'
import PropTypes from "prop-types"

import {
    Typography,
    Chip,
    Tooltip
} from '@material-ui/core'

import useStyles, { playerStyle } from '../styles'

export const PureCharacterChip = ({
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    color = {}
}) => {
    const classes = useStyles()
    return (
        <Tooltip key={Name} interactive arrow title={
            <React.Fragment>
                <Typography variant='subtitle1' align='center'>
                    {Name}
                </Typography>
                { Pronouns && <div>Pronouns: {Pronouns}</div> }
                { FirstImpression && <div>First Impression: {FirstImpression}</div> }
                { OneCoolThing && <div>One Cool Thing: {OneCoolThing}</div> }
                { Outfit && <div>Outfit: {Outfit}</div> }
            </React.Fragment>}
        >
            <div className={classes[playerStyle(color.name)]}>
                <Chip
                    label={Name}
                    classes={{
                        root: `chipColor ${classes.characterChip}`
                    }}
                />
            </div>
        </Tooltip>
    )
}

PureCharacterChip.propTypes = {
    Name: PropTypes.string,
    Pronouns: PropTypes.string,
    FirstImpression: PropTypes.string,
    OneCoolThing: PropTypes.string,
    Outfit: PropTypes.string,
    color: PropTypes.shape({
        primary: PropTypes.string,
        light: PropTypes.string
    }),
}

export default PureCharacterChip
