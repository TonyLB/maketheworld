export const getBackups = ({ backups }) => {
    return new Proxy(backups, {
        get: (obj, prop) => ((obj && obj[prop]) || { Name: '????' })
    })
}
