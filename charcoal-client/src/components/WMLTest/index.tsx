import React, { FunctionComponent, useState } from 'react'

import Box from '@material-ui/core/Box'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import useStyles from '../styles'

import { wmlGrammar, validatedSchema, assetRegistryEntries } from "../../wml/"

type WMLTestProps = {
}

export const WMLTestForm: FunctionComponent<WMLTestProps> = ({}) => {
    const classes = useStyles()

    const [wml, setWML] = useState('')
    const [output, setOutput] = useState('')
    return <Box className={classes.homeContents}>
        <TextField
            required
            multiline
            id="wmlContent"
            label="WML Content"
            value={wml}
            onChange={(event) => { setWML(event.target.value) }}
            style={{ width: "100%" }}
        />
        <Button
            variant="contained"
            onClick={() => {
                const match = wmlGrammar.match(wml)
                if (!match.succeeded()) {
                    console.log('ERROR: Schema failed validation')
                    return []
                }
                const schema = validatedSchema(match)

                const evaluated = assetRegistryEntries(schema)

                setOutput(JSON.stringify(evaluated, null, 4))
            }}
        >
                Evaluate
        </Button>
        <div>{ output }</div>
    </Box>
}

export default WMLTestForm
