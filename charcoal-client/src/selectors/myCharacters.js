export const getMyCharacters = ({ myCharacters }) => (myCharacters && myCharacters.data)

export const getMyCharacterByName = (searchName) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ Name }) => (Name === searchName))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
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

export const getMyCharacterById = (searchId) => ({ myCharacters, permanentHeaders, role }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ CharacterId }) => (CharacterId === searchId))
    if (!matchingCharacters) {
        return {}
    }
    const { Grants = [], ...rest } = matchingCharacters[0]

    const grantMap = Grants.reduce((previous, grant) => ({
        ...previous,
        [grant.Resource]: ((grant.Roles && grant.Roles.split(',').map((role) => (role.trim()))) || []).reduce((previous, roleId) => ({
            ...previous,
            ...stringToBooleanMap((role && role[roleId] && role[roleId].Actions) || '')
        }), stringToBooleanMap(grant.Actions || ''))
    }), {})
    return {
        ...rest,
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

export const getMyCharacterFetchNeeded = ({ myCharacters }) => (!(myCharacters && myCharacters.meta && (myCharacters.meta.fetching || myCharacters.meta.fetched)))
