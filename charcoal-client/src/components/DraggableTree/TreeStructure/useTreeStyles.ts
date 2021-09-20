import { makeStyles } from "@material-ui/core/styles"

export const useTreeStyles = makeStyles((theme) => ({
    VerticalLine: {
        position: "absolute",
        width: "0px",
        top: "30px",
        borderLeft: "1px dashed rgba(0, 0, 0, 0.6)"
    },
    HorizontalLine: {
        position: "absolute",
        top: "0px",
        left: "-15px",
        height: "50%",
        width: "15px",
        borderBottom: "1px dashed rgba(0, 0, 0, 0.6)"
    }
}))

export default useTreeStyles
