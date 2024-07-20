import { Divider, List, ListItem, ListItemButton, Popover, Typography } from "@mui/material"
import { EphemeraAssetId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import React, { FunctionComponent, useCallback, useMemo, useRef } from "react"

type AssetPickerProps = {
    assets: Record<EphemeraAssetId, string>;
    open: boolean;
    setOpen: (value: boolean) => void;
    onSelect: (args: { asset: EphemeraAssetId, key: string }) => void;
    anchorRef: React.MutableRefObject<any>;
}

export const AssetPicker: FunctionComponent<AssetPickerProps> = ({ assets, open, setOpen, onSelect, anchorRef }) => {
    const importOptions = useMemo(() => {
        if (Object.entries(assets).length > 1) {
            return Object.entries(assets)
                .filter(([asset]) => (asset !== 'ASSET#primitives'))
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
        else {
            return Object.entries(assets)
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
    }, [assets])
    return <Popover
        open={open}
        onClose={() => { setOpen(false) }}
        anchorEl={anchorRef.current}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
        }}
    >
        <Typography variant="body2">Branch from?</Typography>
        <Divider />
        <List>
            {
                importOptions.map(({ asset, key }) => (
                    <ListItem key={`Import-${asset}`} >
                        <ListItemButton
                            onClick={() => { onSelect({ asset, key }) }}
                        >
                            { asset.split('#')[1] }
                        </ListItemButton>
                    </ListItem>
                ))
            }
        </List>
    </Popover>

}