import { getCharacters } from './characters'

export const getMyCharacters = (state) => {
    const characters = getCharacters(state)
    const { player } = state
    const returnValue = player && player.Characters && player.Characters.map((characterId) => characters[characterId])
    return returnValue
}

export const getMyCharacterByName = (searchName) => (state) => {
    return getMyCharacters(state).find(({ Name }) => (Name === searchName)) || {}
}

const inheritanceProxy = (headers) => ({
    get: (grants, resource) => {
        const ancestryList = [
            'ROOT',
            ...((headers && headers[resource] && headers[resource].Ancestry && headers[resource].Ancestry.split(':')) || [])
        ]
        const ancestryGrants = ancestryList
            .map((resource) => (`${resource}#MINIMUM`))
            .reduce((previous, resource) => ({
                ...previous,
                ...((grants && grants[resource]) || {})
            }), {})
        return {
            ...((grants && grants['MINIMUM']) || {}),
            ...(ancestryGrants || {}),
            ...((grants && grants[resource]) || {})
        }
    }
})

export const getMyCharacterById = (searchId) => (state) => {
    const { permanentHeaders, role } = state
    const myCharacter = getCharacters(state)[searchId]
    if (!myCharacter) {
        return {}
    }

    const grantMap = myCharacter.Grants.reduce((previous, grant) => ({
        ...previous,
        [grant.Resource]: ((grant.Roles && grant.Roles.split(',').map((role) => (role.trim()))) || []).reduce((previous, roleId) => ({
            ...previous,
            ...stringToBooleanMap((role && role[roleId] && role[roleId].Actions) || '')
        }), stringToBooleanMap(grant.Actions || ''))
    }), {})
    return {
        ...myCharacter,
        Grants: new Proxy(grantMap, inheritanceProxy(permanentHeaders))
    }
}

const stringToBooleanMap = (grants = '') => (
    grants
        .split(',')
        .map((action) => (action.trim()))
        .filter((action) => (action.length))
        .reduce((previous, action) => ({ ...previous, [action]: true }), {})
)

export const getMyCurrentCharacter = (state) => {
    const { connection }  = state || {}
    const { characterId } = connection || {}
    return getMyCharacterById(characterId)(state)
}
