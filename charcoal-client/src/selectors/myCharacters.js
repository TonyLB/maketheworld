export const getMyCharacters = ({ myCharacters }) => (myCharacters && myCharacters.data)

export const getMyCharacterByName = (searchName) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ Name }) => (Name === searchName))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

export const getMyCharacterById = (searchId) => ({ myCharacters }) => {
    const { data = [] } = myCharacters || {}
    const matchingCharacters = data.filter(({ CharacterId }) => (CharacterId === searchId))
    if (!matchingCharacters) {
        return {}
    }
    return matchingCharacters[0]
}

const stringToBooleanMap = (grants = '') => (
    grants
        .split(',')
        .map((action) => (action.trim()))
        .filter((action) => (action.length))
        .reduce((previous, action) => ({ ...previous, [action]: true }), {})
)

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

export const getMyCurrentCharacter = (state) => {
    const { connection, permanentHeaders, role = {} }  = state || {}
    const { characterId } = connection || {}
    if (characterId) {
        const { Grants = [], ...rest } = getMyCharacterById(characterId)(state)
        //
        // ToDo: Make Minimum grants an accumulation of every minimum in the ancestry of the resource,
        // and apply them everywhere relevant, or make a global lookup function to take the grantMap
        // and calculate grants on a given resource.
        //
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
    else {
        return {}
    }
}

export const getMyCharacterFetchNeeded = ({ myCharacters }) => (!(myCharacters && myCharacters.meta && (myCharacters.meta.fetching || myCharacters.meta.fetched)))
