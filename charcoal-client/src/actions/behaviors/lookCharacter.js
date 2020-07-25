import { receiveMessage } from '../messages'

export const lookCharacter = ({ Name, Pronouns, FirstImpression, OneCoolThing, Outfit }) => (dispatch) => {
    return dispatch(receiveMessage({
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