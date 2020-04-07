/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getCharacter = /* GraphQL */ `
  query GetCharacter($playerName: String!, $name: String!) {
    getCharacter(playerName: $playerName, name: $name) {
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
export const getPlayerCharacters = /* GraphQL */ `
  query GetPlayerCharacters {
    getPlayerCharacters {
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
export const getCharactersInPlay = /* GraphQL */ `
  query GetCharactersInPlay {
    getCharactersInPlay {
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
export const getNeighborhoodTree = /* GraphQL */ `
  query GetNeighborhoodTree {
    getNeighborhoodTree {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
    }
  }
`;
export const getNeighborhood = /* GraphQL */ `
  query GetNeighborhood($PermanentId: String!) {
    getNeighborhood(PermanentId: $PermanentId) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
    }
  }
`;
