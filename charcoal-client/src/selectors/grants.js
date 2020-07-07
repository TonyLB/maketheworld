export const getGrantsByResource = ({ grants }) => {
    return new Proxy(grants, {
        get: (obj, prop) => {
            const allGrants = Object.values(grants || []).reduce((previous, grantList) => ([ ...previous, ...grantList ]), [])
            return allGrants.filter(({ Resource }) => (Resource === prop))
        }
    })
}
