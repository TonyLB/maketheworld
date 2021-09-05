import { makeStyles } from "@material-ui/core/styles"

export const useMapStyles = makeStyles((theme) => ({
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
        display: 'grid',
        justifyContent: "stretch",
        gridTemplateAreas: `"content"`,
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
        '@media (orientation: landscape) and (min-width: 1500px)': {
            gridTemplateAreas: `
                "content sidebar"
            `,
            gridTemplateColumns: "1fr 400px",
            gridTemplateRows: "1fr"
        }
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
        "& > div": {
            position: "absolute",
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
    },
}))

export default useMapStyles