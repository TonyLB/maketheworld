import { makeStyles } from "@material-ui/core/styles"
import Dash from './Dash.svg'

export const useTreeStyles = makeStyles((theme) => ({
    VerticalLine: {
        position: "absolute",
        width: "0px",
        top: "34px",
        borderLeft: "1px dashed rgba(0, 0, 0, 0.6)",
        zIndex: 1
    },
    SideVerticalLine: {
        position: "absolute",
        left: "17px",
        top: "17px",
        width: "0px",
        borderLeft: "1px dashed rgba(0, 0, 0, 0.6)",
        zIndex: 0
    },
    HorizontalLine: {
        position: "absolute",
        top: "0px",
        left: "-17px",
        height: "50%",
        width: "17px",
        borderBottom: "1px dashed rgba(0, 0, 0, 0.6)",
        zIndex: 1
    },
    Collapsar: {
        position: "absolute",
        borderRadius: "100%",
        width: "15px",
        height: "15px",
        top: "50%",
        transform: "translate(-50%, -50%)",
        cursor: "pointer",
        backgroundColor: "white",
        border: "1px solid black",
        zIndex: 2
    },
    TreeContentSections: {
        position: "absolute",
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateAreas: `"handle content"`,
        gridTemplateColumns: "30px 1fr",
        gridTemplateRows: "1fr",
        gridGap: "2px"
    },
    TreeContentHandle: {
        position: "absolute",
        width: "30px",
        height: "100%",
        gridArea: "handle",
        backgroundImage: `url(${Dash})`,
        borderRadius: "5px 0px 0px 5px",
        color: "white",
        background: "lightgrey"
    },
    TreeContent: {
        position: "absolute",
        width: "100%",
        height: "100%",
        gridArea: "content",
        borderRadius: "0px 5px 5px 0px",
        color: "black",
        background: "lightblue"
    },
    Highlighted: {
        position: "relative",
        width: "320px",
        height: "30px",
        marginTop: "2px",
        marginBottom: "2px",
        lineHeight: "30px",
        fontSize: "14.5px",
        touchAction: "none",
        userSelect: "none",
    },
    Dragging: {
        '& div$Highlighted': {
            position: "absolute",
        },
        '& div$TreeContent, & div$TreeContentHandle': {
            backgroundImage: '',
            color: "blue",
            background: "#ffffffaa",
            border: "1px solid blue"
        }
    },
    DraggingSource: {
        '& div$TreeContent, & div$TreeContentHandle': {
            backgroundImage: '',
            color: "black",
            background: "#ffffffaa",
            border: "1px solid black"
        }
    },
    DraggingTarget: {
        '& div$TreeContent, & div$TreeContentHandle': {
            backgroundImage: '',
            color: "white",
            background: "blue",
            border: "1px solid lightblue"
        }
    }
}))

export default useTreeStyles
