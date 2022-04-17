import { blue } from "@mui/material/colors"
import makeStyles from '@mui/styles/makeStyles'
import { Theme } from '@mui/material/styles'

export const useMapStyles = makeStyles((theme: Theme) => ({
    green: {
        fill: 'lightgreen',
        stroke: 'darkgreen',
        strokeWidth: '10 px'
    },
    blue: {
        fill: 'lightblue',
        stroke: 'darkblue',
        strokeWidth: '10 px'
    },
    red: {
        fill: 'pink',
        stroke: 'darkred',
        strokeWidth: '10 px'
    },
    grid: {
        backgroundColor: theme.palette.background.paper,
        height: '100%',
        display: 'grid',
        justifyContent: "stretch",
        gridTemplateAreas: `
            "content sidebar"
        `,
        gridTemplateColumns: "1fr 400px",
        gridTemplateRows: "1fr"
    },
    tabs: {
        gridArea: "tabs",
        overflow: "hidden"
    },
    tabRootHorizontal: {
        width: "100%"
    },
    content: {
        gridArea: "content",
        position: "relative",
        width: "100%",
        height: "100%"
    },
    sidebar: {
        gridArea: "sidebar",
        position: "relative",
        width: "100%",
        height: "100%",
        // backgroundColor: theme.palette.primary,
        overflowY: "auto",
        overflowX: "visible",
    },
    highlighted: {
        position: "relative",
        width: "320px",
        height: "30px",
        borderRadius: "5px",
        color: "black",
        lineHeight: "30px",
        paddingLeft: "32px",
        fontSize: "14.5px",
        background: "lightblue",
        touchAction: "none",
    },
    svgLightBlue: {
        fill: blue[50]
    },
    svgLightBlueContrast: {
        fill: theme.palette.getContrastText(blue[50])
    },
    roomNode: {
        fill: blue[50],
        touchAction: "none"
    },
    renderWrapper: {
        width: "100%",
        height: "100%",
        display: 'grid',
        gridTemplateAreas: `"visibilityControl content"`,
        gridTemplateColumns: "20px 1fr"
    },
    visibilityControl: {
        gridArea: 'visibilityControl',
        paddingTop: "4px"
    },
    overriddenVisibilityControl: {
        gridArea: 'visibilityControl',
        paddingTop: "4px",
        opacity: "0.4",
    },
    renderContent: {
        gridArea: 'content',
        paddingLeft: "5px"
    }
}))

export default useMapStyles