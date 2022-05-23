import React, { FunctionComponent, useEffect, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Stack,
    CircularProgress,
    IconButton,
    TextField,
    Button
} from '@mui/material'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus,
    getWMLQuery
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { NormalAsset, NormalCharacter } from '../../../wml/normalize'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import MapHeader from './MapHeader'
import WMLComponentDetail from './WMLComponentDetail'
import AddWMLComponent from './AddWMLComponent'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'

type CharacterEditFormProps = {}

const CharacterEditForm: FunctionComponent<CharacterEditFormProps> = () => {
    const { normalForm, wmlQuery, updateWML, save } = useLibraryAsset()
    const navigate = useNavigate()

    const character = Object.values(normalForm || {}).find(({ tag }) => (['Character'].includes(tag))) as NormalCharacter | undefined
    return <Box sx={{ width: "100%" }}>
        <LibraryBanner
            primary={character?.Name || 'Unnamed'}
            secondary={character?.key || ''}
            commands={
                <IconButton onClick={() => { navigate(`WML`) }}>
                    <TextSnippetIcon />
                </IconButton>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: character?.Name || 'Unnamed'
                }
            ]}
        />
        <Stack sx={{ marginLeft: '20px' }}>
            <TextField
                required
                id="name-field"
                label="Name"
                value={character?.Name || ''}
            />
        </Stack>
        <Button onClick={save}>Save</Button>
    </Box>
}

type EditCharacterProps = {}

export const EditCharacter: FunctionComponent<EditCharacterProps> = () => {

    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `CHARACTER#${assetKey}`
    useAutoPin({
        href: `/Library/Edit/Character/${assetKey}`,
        label: `${assetKey}`
    })
    const dispatch = useDispatch()
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: `CHARACTER#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    const currentStatus = useSelector(getStatus(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))

    return (['FRESH', 'DIRTY'].includes(currentStatus || '') && wmlQuery)
        ? 
            <LibraryAsset assetKey={assetKey || ''} character>
                <Routes>
                    <Route path={'WML'} element={<WMLEdit />} />
                    <Route path={''} element={<CharacterEditForm />} />
                </Routes>
            </LibraryAsset>
            
        : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>

}

export default EditCharacter
