import { makeStyles } from "@material-ui/core/styles"

export const useTreeStyles = makeStyles((theme) => ({
    VerticalLine: {
        position: "absolute",
        width: "0px",
        top: "30px",
        borderLeft: "1px dashed rgba(0, 0, 0, 0.6)",
        zIndex: 1
    },
    SideVerticalLine: {
        position: "absolute",
        left: "15px",
        top: "15px",
        width: "0px",
        borderLeft: "1px dashed rgba(0, 0, 0, 0.6)",
        zIndex: 0
    },
    HorizontalLine: {
        position: "absolute",
        top: "0px",
        left: "-15px",
        height: "50%",
        width: "15px",
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
    }
}))

export default useTreeStyles
