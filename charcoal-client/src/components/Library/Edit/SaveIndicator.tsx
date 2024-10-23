import { FunctionComponent } from "react"
import { useLibraryAsset } from "./LibraryAsset"
import Chip from "@mui/material/Chip"
import Box from "@mui/material/Box"
import Spinner from "../../Spinner"

export const SaveIndicator: FunctionComponent<{}> = () => {
    const { saving } = useLibraryAsset()
    return saving
        ? <Chip icon={<Box sx={{ marginRight: "0.5em" }}><Spinner size={20} border={2} /></Box>} label="Saving" />
        : null
}