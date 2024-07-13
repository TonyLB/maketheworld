import { EphemeraAssetId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import React, { FunctionComponent, useCallback, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { addOnboardingComplete } from "../../slices/player/index.api"
import { addImport } from "../../slices/personalAssets"
import Chip from "@mui/material/Chip"
import { AssetPicker } from "../AssetPicker"
import { getPlayer } from "../../slices/player"
import { objectFilter } from "../../lib/objects"

export const EditButton: FunctionComponent<{ tag: 'Room' | 'Map' | 'Knowledge'; assets: Record<EphemeraAssetId, string> }> = ({ tag, assets }) => {
    const { PlayerName } = useSelector(getPlayer)
    const navigate = useNavigate()
    const [open, setOpen] = useState<boolean>(false)
    const ref = useRef(null)
    const dispatch = useDispatch()
    const importOptions = useMemo(() => {
        if (assets[`ASSET#draft[${PlayerName}]`]) {
            return [{ asset: 'ASSET#draft' as const, key: assets[`ASSET#draft[${PlayerName}]`] }]
        }
        const relevantAssets = objectFilter(assets, (value) => (Boolean(value)))
        if (Object.entries(relevantAssets).length > 1) {
            return Object.entries(relevantAssets)
                .filter(([asset]) => (asset !== 'ASSET#primitives'))
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
        else {
            return Object.entries(relevantAssets)
                .map(([asset, key]) => ({ asset: asset as EphemeraAssetId, key }))
        }
    }, [assets])
    const onImportListItemClick = useCallback(({ asset, key }: { asset: EphemeraAssetId, key: string }) => {
        if (tag === 'Room') {
            dispatch(addOnboardingComplete(['importRoom']))
        }
        dispatch(addImport({ assetId: `ASSET#draft`, fromAsset: asset.split('#')[1], type: tag, key }))
        navigate(`/Draft/${tag}/${key}`)
    }, [navigate, tag])
    const onClick = useCallback(() => {
        if (importOptions.length > 1) {
            setOpen(true)
        }
        else {
            if (importOptions.length) {
                onImportListItemClick(importOptions[0])
            }
        }
    }, [importOptions, setOpen, onImportListItemClick])
    return <React.Fragment>
        <Chip
            label="Edit"
            onClick={onClick}
            ref={ref}
        />
        <AssetPicker
            open={open}
            setOpen={setOpen}
            assets={assets}
            onSelect={onImportListItemClick}
            anchorRef={ref}
        />
    </React.Fragment>
}

export default EditButton
