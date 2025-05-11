const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs } = require('./typeDefs.js');
const { resolvers } = require('./resolvers.js');

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

module.exports = {
    schema
};
