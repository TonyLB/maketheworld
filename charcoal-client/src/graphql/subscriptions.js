/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const changedCharacter = /* GraphQL */ `
  subscription ChangedCharacter {
    changedCharacter {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
    }
  }
`;
export const changedCharactersInPlay = /* GraphQL */ `
  subscription ChangedCharactersInPlay {
    changedCharactersInPlay {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
