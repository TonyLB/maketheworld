import { FunctionComponent } from "react"
import { useSelector } from "react-redux"
import { getStatus } from "../../../slices/personalAssets"
import { useLibraryAsset } from "./LibraryAsset"
import Box from '@mui/material/Box'

export const DraftLockout: FunctionComponent<{}> = () => {
    const { AssetId } = useLibraryAsset()
    const currentStatus = useSelector(getStatus(AssetId))
    return currentStatus === 'DRAFTERROR'
        ? <Box sx={{
            zIndex: 1,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, .2)",
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            flexDirection: "row"
        }}>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{
                display: "flex",
                flexDirection: "column"
            }}>
                <Box sx={{ flexGrow: 1 }} />
                    <Box>
                        TEST
                    </Box>
                <Box sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ flexGrow: 1 }} />
        </Box>
        : null
}

export default DraftLockout
