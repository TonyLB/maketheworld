import { receiveMessage } from '../messages'

export const lookCharacter = (CharacterId) => ({ Name, Pronouns, FirstImpression, OneCoolThing, Outfit }) => (dispatch) => {
    return dispatch(receiveMessage({
        Target: CharacterId,
        Message: [
            Name,
            ...(Pronouns ? [ `Pronouns: ${Pronouns}`] : []),
            ...(FirstImpression ? [ `First Impression: ${FirstImpression}`] : []),
            ...(OneCoolThing ? [ `One Cool Thing: ${OneCoolThing}`] : []),
            ...(Outfit ? [ `Outfit: ${Outfit}`] : []),
        ].join("\n")
    }))
}

export default lookCharacter