import React, { FunctionComponent, useCallback, useMemo, useRef } from "react"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { useMapContext } from "./MapController"
import {
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText
} from "@mui/material"
import { grey } from '@mui/material/colors'
import RoomIcon from '@mui/icons-material/Home'
import AddIcon from '@mui/icons-material/Add'
import { useDispatch } from "react-redux"
import { addOnboardingComplete } from "../../../slices/player/index.api"
import TutorialPopover from "../../Onboarding/TutorialPopover"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardMap } from "@tonylb/mtw-wml/ts/standardize/components/map"
import { excludeUndefined } from "../../../lib/lists"
import { componentDisplayLabel } from "../../../lib/componentDisplayLabel"

type UnshownRoomsProps = {

}

export const UnshownRooms: FunctionComponent<UnshownRoomsProps> = () => {
    const { standardForm, localStandardForm } = useWorkbenchAsset()
    const { mapId, UI: { itemSelected }, mapDispatch } = useMapContext()
    const dispatch = useDispatch()

    const shownRooms = useMemo(() => {
        const mapComponent = localStandardForm.byUniversalId[mapId]
        if (!(mapComponent instanceof StandardMap)) {
            return []
        }
        return mapComponent.positions.items
            .map((facet) => facet.reference.universalKey)
            .filter(excludeUndefined)
            .map((roomId) => {
                const roomComponent = localStandardForm.byUniversalId[roomId]
                return roomComponent?.key
            })
            .filter(excludeUndefined)
    }, [localStandardForm, mapId])
    const unshownRoomItems = standardForm.components
        .filter((component): component is StandardRoom => (component instanceof StandardRoom))
        .filter((room) => (room.key && !shownRooms.includes(room.key)))
    const nameFromKey = useCallback((key: string | undefined): string => {
        if (!key) return 'Untitled'
        const component = standardForm.byId[key]
        if (component && component instanceof StandardRoom) {
            return componentDisplayLabel(component, { fallbackLabel: 'Untitled' }) ?? 'Untitled'
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
                            if (key) {
                                mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoom', key: key as `ROOM#${string}` }})
                                mapDispatch({ type: 'SetToolSelected', value: 'AddRoom' })
                            }
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
            anchorEl={addNewRoomRef as any}
            placement="bottom"
            checkPoints={['addNewRoom']}
        />
    </React.Fragment>
}

export default UnshownRooms
