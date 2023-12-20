import { FunctionComponent, useMemo } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset"
import { isNormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { useMapContext } from "../../Controller"
import { GenericTree } from "@tonylb/mtw-wml/dist/sequence/tree/baseClasses"
import { MapTreeItem } from "../../Controller/baseClasses"
import { unique } from "../../../../lib/lists"
import {
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText
} from "@mui/material"
import { blue, grey } from '@mui/material/colors'
import RoomIcon from '@mui/icons-material/Home'
import AddIcon from '@mui/icons-material/Add'
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"

type UnshownRoomsProps = {

}

const extractRooms = (tree: GenericTree<MapTreeItem>): string[] => {
    return unique(
        tree.map(({ data, children }) => ([
            ...data.tag === 'Room' ? [data.key] :[],
            ...extractRooms(children)
        ])).flat()
    )
}

export const UnshownRooms: FunctionComponent<UnshownRoomsProps> = () => {
    const { normalForm } = useLibraryAsset()
    const { tree, UI: { itemSelected }, mapDispatch } = useMapContext()
    const shownRooms = useMemo(() => (extractRooms(tree)), [tree])
    const unshownRoomItems = Object.values(normalForm)
        .filter(isNormalRoom)
        .filter(({ key }) => (!shownRooms.includes(key)))
    return <List>
        {
            unshownRoomItems.map(({ key, appearances }) => (
                <ListItemButton
                    key={key}
                    dense
                    sx={{ width: '100%' }}
                    selected={itemSelected?.type === 'UnshownRoom' && itemSelected?.key === key}
                    onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoom', key }})}}
                >
                    <ListItemAvatar>
                        <RoomIcon sx={{ fontSize: "15px", color: grey[500] }} />
                    </ListItemAvatar>
                    <ListItemText primary={taggedMessageToString(appearances[0].name)} />
                </ListItemButton>
            ))
        }
        <ListItemButton
            dense
            sx={{ width: '100%' }}
            selected={itemSelected?.type === 'UnshownRoomNew'}
            onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoomNew' }})}}
        >
            <ListItemAvatar>
                <AddIcon sx={{ fontSize: "15px", color: grey[500] }} />
            </ListItemAvatar>
            <ListItemText primary="Add New Room" />
        </ListItemButton>
    </List>
}