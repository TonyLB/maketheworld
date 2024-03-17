import Box from "@mui/material/Box"
import { blue } from "@mui/material/colors"
import { FunctionComponent } from "react"

type TitledBoxProperties = {
    title?: string;
}

export const TitledBox: FunctionComponent<TitledBoxProperties> = ({ title, children }) => {
    if (title) {
        return <Box
            sx={{
                border: `2px solid ${blue[500]}`, borderRadius: '0.5em',
                paddingTop: "1em",
                position: "relative",
                marginTop: "1em"
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: "-1em",
                    left: "0.25em",
                    border: `2px solid ${blue[500]}`, borderRadius: '0.5em',
                    background: blue[100],
                    paddingLeft: "0.5em",
                    paddingRight: "0.5em"
                }}
            >
                {title}
            </Box>
            { children }
        </Box>
    }
    else {
        return <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
            { children }
        </Box>
    }
}

export default TitledBox
