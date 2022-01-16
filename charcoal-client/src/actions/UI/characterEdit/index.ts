import { CharacterEditRecord } from '../../../slices/characterEdit'
import { socketDispatchPromise, apiDispatchPromise } from '../../../slices/lifeLine'
import { getMyCharacterByKey } from '../../../slices/player'
import { setDefaults, setFetching, setFetched } from '../../../slices/characterEdit'
import { v4 as uuidv4 } from 'uuid'
import { wmlGrammar, validatedSchema, assetRegistryEntries } from "../../../wml/"

export const saveCharacter = ({ value }: CharacterEditRecord, wml: string) => (dispatch: any, getState: any): Promise<string> => {
    const uploadRequestId = uuidv4()
    return dispatch(socketDispatchPromise('upload')({
            fileName: `${value.assetKey}.wml`,
            uploadRequestId
        }))
        .then(({ url }: { url: string }) => url)
        .then((url: string) => (apiDispatchPromise(url, uploadRequestId)(wml)))
        .catch(() => null)
}

export const fetchCharacter = (characterKey: string) => async (dispatch: any, getState: any) => {
    const character = getMyCharacterByKey(characterKey)(getState())
    if (character) {
        dispatch(setFetching({ characterKey }))
        //
        // TODO: Figure out a better way to store/get the player-scoped filename,
        // that doesn't require pulling it out of its string structure (presumably
        // as part of a more comprehensive asset scoping system)
        //
        const fileName = character.fileName.split('/').slice(-1)[0].split('.')[0]
        const { url } = await dispatch(socketDispatchPromise('fetch')({
            fileName: `${fileName}.wml`
        }))
        const contents = await fetch(url, { method: 'GET' }).then((response) => (response.text()))
        const match = wmlGrammar.match(contents)
        if (!match.succeeded()) {
            console.log('ERROR: Schema failed validation')
            return {}
        }
        const schema = validatedSchema(match)

        const evaluated = assetRegistryEntries(schema).find(({ tag }: { tag: string }) => (tag === 'Character'))

        if (evaluated) {
            const defaultValue = {
                assetKey: characterKey,
                Name: evaluated.Name || '',
                Pronouns: evaluated.Pronouns || '',
                FirstImpression: evaluated.FirstImpression || '',
                OneCoolThing: evaluated.OneCoolThing || '',
                Outfit: evaluated.Outfit || ''
            }
    
            dispatch(setDefaults({
                characterKey,
                defaultValue
            }))
            dispatch(setFetched({ characterKey }))

            return defaultValue
    
        }

        //
        // TODO: Create pending and rejected parameters in the characterEdit UI
        // slice, and populate them as appropriate.
        //

        return {}

    }
    else {
        console.log(`ERROR: No such character by key: ${characterKey}`)
        return {}
    }
}