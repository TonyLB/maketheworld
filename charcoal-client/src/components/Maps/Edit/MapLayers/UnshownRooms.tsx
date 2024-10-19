import React, { FunctionComponent, useCallback, useMemo, useRef } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset"
import { useMapContext } from "../../Controller"
import {
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText
} from "@mui/material"
import { grey } from '@mui/material/colors'
import RoomIcon from '@mui/icons-material/Home'
import AddIcon from '@mui/icons-material/Add'
import { selectKeysByTag } from "@tonylb/mtw-wml/dist/schema/selectors/keysByTag"
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString"
import { isStandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { useDispatch } from "react-redux"
import { addOnboardingComplete } from "../../../../slices/player/index.api"
import TutorialPopover from "../../../Onboarding/TutorialPopover"
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils"

type UnshownRoomsProps = {

}

export const UnshownRooms: FunctionComponent<UnshownRoomsProps> = () => {
    const { standardForm } = useLibraryAsset()
    const { tree, UI: { itemSelected }, mapDispatch } = useMapContext()
    const dispatch = useDispatch()
    const shownRooms = useMemo(() => (selectKeysByTag('Room')(tree)), [tree])
    const unshownRoomItems = Object.values(standardForm.byId)
        .filter(isStandardRoom)
        .filter(({ key }) => (!shownRooms.includes(key)))
    const nameFromKey = useCallback((key: string): string => {
        const component = standardForm.byId[key]
        if (component && isStandardRoom(component)) {
            return schemaOutputToString(ignoreWrapped(component.shortName)?.children ?? []) || 'Untitled'
        }
        return 'Untitled'
    }, [standardForm])
    const addNewRoomRef = useRef(null)
    return <React.Fragment>
        <List>
            {
                unshownRoomItems.map(({ key }) => (
                    <ListItemButton
                        key={key}
                        dense
                        sx={{ width: '100%' }}
                        selected={itemSelected?.type === 'UnshownRoom' && itemSelected?.key === key}
                        onClick={() => { 
                            mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoom', key }})
                            mapDispatch({ type: 'SetToolSelected', value: 'AddRoom' })
                        }}
                    >
                        <ListItemAvatar>
                            <RoomIcon sx={{ fontSize: "15px", color: grey[500] }} />
                        </ListItemAvatar>
                        <ListItemText primary={ nameFromKey(key) } />
                    </ListItemButton>
                ))
            }
            <ListItemButton
                dense
                sx={{ width: '100%' }}
                selected={itemSelected?.type === 'UnshownRoomNew'}
                onClick={() => {
                    dispatch(addOnboardingComplete(['addNewRoom']))
                    mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoomNew' }})
                    mapDispatch({ type: 'SetToolSelected', value: 'AddRoom' })
                }}
                ref={addNewRoomRef}
            >
                <ListItemAvatar>
                    <AddIcon sx={{ fontSize: "15px", color: grey[500] }} />
                </ListItemAvatar>
                <ListItemText primary="Add New Room" />
            </ListItemButton>
        </List>
        <TutorialPopover
            anchorEl={addNewRoomRef}
            placement="bottom"
            checkPoints={['addNewRoom']}
        />
    </React.Fragment>
}