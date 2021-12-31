import { socketDispatchPromise, apiDispatchPromise } from '../../actions/communicationsLayer/lifeLine'
import { CharacterEditAction, CharacterEditCondition } from './baseClasses'
import { getMyCharacterByKey } from '../../selectors/player'
import { wmlGrammar, validatedSchema, assetRegistryEntries } from "../../wml/"
import { getLifeLine } from '../../selectors/communicationsLayer'

export const lifelineCondition: CharacterEditCondition = ({ internalData: { id } }, getState) => {
    const state = getState()
    const { status } = getLifeLine(state)
    const character = getMyCharacterByKey(id)(state)

    return (status === 'CONNECTED') && (Boolean(character))
}

export const getURL: CharacterEditAction = ({ internalData: { id } }) => async (dispatch, getState) => {
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
    const { url } = await dispatch(socketDispatchPromise('fetch')({
        fileName: `${fileName}.wml`
    }))

    return { internalData: { fetchURL: url } }
}

export const fetchCharacterWML: CharacterEditAction = ({ internalData: { fetchURL } }) => async (dispatch, getState) => {
    if (!fetchURL) {
        throw new Error()
    }
    const characterWML = await fetch(fetchURL, { method: 'GET' }).then((response) => (response.text()))
    return { internalData: { characterWML }}
}

export const parseCharacterWML: CharacterEditAction = ({ internalData: { id, characterWML } }) => async (dispatch, getState) => {
    if (!characterWML) {
        throw new Error()
    }
    const match = wmlGrammar.match(characterWML)
    if (!match.succeeded()) {
        console.log('ERROR: Schema failed validation')
        throw new Error('Schema failed validation')
    }
    const schema = validatedSchema(match)

    const evaluated = assetRegistryEntries(schema).find(({ tag }: { tag: string }) => (tag === 'Character'))

    if (evaluated) {
        const defaultValue = {
            assetKey: id,
            Name: evaluated.Name || '',
            Pronouns: evaluated.Pronouns || '',
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