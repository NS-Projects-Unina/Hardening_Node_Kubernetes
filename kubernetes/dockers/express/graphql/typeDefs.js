const typeDefs = `#graphql

type User {
  id: ID!
  username: String!
  email: String!
  bio: String
  created_at: String!
  updated_at: String!
  otpEnabled: Boolean!
  experiences: [Experience!]!
  savedExperiences: [Experience!]!
}

type Experience {
  id: ID!
  title: String!
  content: String!
  createdAt: String!
  updatedAt: String!
  isPrivate: Boolean!
  author: User!
  categories: [Category!]!
}

type Category {
  id: ID!
  name: String!
}

type Query {
  me: User!
  getMyExperiences: [Experience!]!
  allPublicExperiences(categoryId: ID): [Experience!]!
  getSavedExperiences: [Experience!]!
  allCategories: [Category!]!
}

type Mutation {
  updateProfile(bio: String): User
  createExperience(title: String!, content: String!, categoryIds: [ID!]!, isPrivate: Boolean!): Experience
  updateExperience(id: ID!, title: String, content: String, categoryIds: [ID!], isPrivate: Boolean): Experience
  deleteExperience(id: ID!): Boolean
  saveExperience(experienceId: ID!): Boolean
  unsaveExperience(experienceId: ID!): Boolean
}

`;

module.exports = {
  typeDefs
};