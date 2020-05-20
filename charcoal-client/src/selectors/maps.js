export const getMaps = ({ maps = {} }) => {
    return new Proxy(
        maps,
            {
                get: (obj, prop) => ((obj && obj[prop]) || {
                    PermanentId: prop,
                    Rooms: {}
                })
            }
    )
}
