import Box from "@mui/material/Box";
import { FunctionComponent } from "react";

export const ScreenCenter: FunctionComponent<{}> = ({ children }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignContent: 'center',
        height: "100%",
    }}>
        <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignContent: 'center',
            width: "100%",
        }}>{ children }</Box>
    </Box>
)

export default ScreenCenter
