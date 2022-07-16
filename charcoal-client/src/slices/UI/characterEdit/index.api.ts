import { v4 as uuidv4 } from 'uuid'

import { socketDispatchPromise, apiDispatchPromise } from '../../lifeLine'
import { CharacterEditAction, CharacterEditCondition, CharacterEditPublic } from './baseClasses'
import { getMyCharacterByKey, getPlayer } from '../../player'
import { validatedSchema } from "../../../wml"
import normalize, { NormalItem, NormalCharacter } from '../../../wml/normalize.js'
import wmlGrammar from '../../../wml/wmlGrammar/wml.ohm-bundle'
import { getStatus } from '../../lifeLine'

export const lifelineCondition: CharacterEditCondition = ({ internalData: { id } }, getState) => {
    const state = getState()
    const status = getStatus(state)
    const character = getMyCharacterByKey(id)(state)

    return (status === 'CONNECTED') && (Boolean(character))
}

export const getURL: CharacterEditAction = ({ internalData: { id } }) => async (dispatch, getState) => {
    if (id === 'New') {
        return {}
    }
    const character = getMyCharacterByKey(id)(getState())
    if (!character) {
        throw new Error()
    }
    //
    // TODO: Figure out a better way to store/get the player-scoped filename,
    // that doesn't require pulling it out of its string structure (presumably
    // as part of a more comprehensive asset scoping system)
    //
    const fileName = character.fileName.split('/').slice(-1)[0].split('.')[0]
    const { url } = await dispatch(socketDispatchPromise({
        message: 'fetch',
        fileName: `${fileName}.wml`
    }, { service: 'asset' }))

    return { internalData: { fetchURL: url } }
}

export const getPostURL: CharacterEditAction = ({ internalData: { id } }) => async (dispatch, getState) => {
    if (id === 'New') {
        return {}
    }
    const character = getMyCharacterByKey(id)(getState())
    if (!character) {
        throw new Error()
    }
    //
    // TODO: Figure out a better way to store/get the player-scoped filename,
    // that doesn't require pulling it out of its string structure (presumably
    // as part of a more comprehensive asset scoping system)
    //
    const uploadRequestId = uuidv4()
    const fileName = character.fileName.split('/').slice(-1)[0].split('.')[0]
    const { url } = await dispatch(socketDispatchPromise({
        message: 'upload',
        fileName: `${fileName}.wml`,
        uploadRequestId
    }, { service: 'asset' }))

    return { internalData: {
        postURL: url,
        uploadRequestId
    } }
}

export const fetchCharacterWML: CharacterEditAction = ({ internalData: { id, fetchURL } }) => async (dispatch, getState) => {
    if (id === 'New') {
        return {}
    }
    if (!fetchURL) {
        throw new Error()
    }
    const characterWML = await fetch(fetchURL, { method: 'GET' }).then((response) => (response.text()))
    return { internalData: { characterWML }}
}

export const parseCharacterWML: CharacterEditAction = ({ internalData: { id, characterWML } }) => async (dispatch, getState) => {
    if (id === 'New') {
        return {}
    }
    if (!characterWML) {
        throw new Error()
    }
    const match = wmlGrammar.match(characterWML)
    if (!match.succeeded()) {
        console.log('ERROR: Schema failed validation')
        throw new Error('Schema failed validation')
    }
    const schema = validatedSchema(match)

    const evaluated = (Object.values(normalize(schema)) as NormalItem[]).find(({ tag }: { tag?: string } = {}) => (tag === 'Character')) as unknown as NormalCharacter

    if (evaluated) {
        const defaultValue = {
            assetKey: id,
            Name: evaluated.Name || '',
            //
            // This API needs a rewrite to handle pronouns
            //
            Pronouns: JSON.stringify(evaluated.Pronouns) || '',
            FirstImpression: evaluated.FirstImpression || '',
            OneCoolThing: evaluated.OneCoolThing || '',
            Outfit: evaluated.Outfit || ''
        }

        return { publicData: { defaultValue } }

    }
    else {
        throw new Error()
    }
}

//
// TODO: Get PlayerName and include it as a player tag in the generated WML
//
const characterWML = (value: { fileName: string; player: string } & CharacterEditPublic['value']): string => {
    return [
        `<Character key="${value.assetKey}" fileName="${value.fileName}" player="${value.player}">`,
        `\t<Name>${value.Name}</Name>`,
        `\t<Pronouns>${value.Pronouns}</Pronouns>`,
        ...(value.FirstImpression ? [`\t<FirstImpression>${value.FirstImpression}</FirstImpression>`]: []),
        ...(value.OneCoolThing ? [`\t<OneCoolThing>${value.OneCoolThing}</OneCoolThing>`]: []),
        ...(value.Outfit ? [`\t<Outfit>${value.Outfit}</Outfit>`]: []),
        '</Character>'
    ].join('\n')
}

export const postCharacterWML: CharacterEditAction = ({
    internalData: {
        id,
        postURL,
        uploadRequestId
    },
    publicData: {
        defaultValue,
        value
    }
}) => async (dispatch, getState) => {
    if (!value || !postURL || !uploadRequestId) {
        throw new Error()
    }
    const { assetKey, Name } = { ...defaultValue, ...value }
    if (!assetKey || !Name) {
        throw new Error()
    }
    const state = getState()
    const character = getMyCharacterByKey(id)(state)
    const { PlayerName: player } = getPlayer(state)
    //
    // TODO: Figure out a better way to store/get the player-scoped filename,
    // that doesn't require pulling it out of its string structure (presumably
    // as part of a more comprehensive asset scoping system)
    //
    const fileName = character.fileName.split('/').slice(-1)[0].split('.')[0]
    await apiDispatchPromise(postURL, uploadRequestId)(characterWML({
        player,
        fileName,
        ...defaultValue,
        ...value
    }))
    return {}
}