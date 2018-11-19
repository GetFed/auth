import { ApolloServer, makeExecutableSchema } from 'apollo-server'
import {
  createApolloAccounts,
  accountsContext,
  onLogin,
  onCreateUser
} from './apollo-accounts-password-server'
import { merge } from 'lodash'
import mongodb from 'mongodb'

onLogin(info => console.log('onLogin', info))
onCreateUser(user => console.log('onCreateUser', user))

const start = async () => {
  const client = await mongodb.MongoClient.connect(
    process.env.MONGO_URL || 'mongodb://127.0.0.1:3004/meteor',
    { useNewUrlParser: true }
  )

  const db = client.db()

  const accounts = createApolloAccounts({
    db,
    tokenSecret: process.env.TOKEN_SECRET || "awesome_secret_key", // not abcd
    siteUrl:
      process.env.NODE_ENV === 'production'
        ? 'https://myapp.com'
        : 'http://localhost:3000'
  })

  const typeDefs = `
  type PrivateType @auth {
    field: String
  }

  type Query {
    publicField: String
    privateField: String @auth
    privateType: PrivateType
    adminField: String @auth
  }

  type Mutation {
    _: String
  }

  extend type User {
    firstName: String
  }
  `

  const resolvers = {
    Query: {
      publicField: () => 'public',
      privateField: () => 'private',
      privateType: () => ({
        field: () => 'private'
      }),
      adminField: (root, args, context) => {
        if (context.user.isAdmin) {
          return 'admin field'
        }
      }
    },
    User: {
      firstName: () => 'first'
    }
  }

  const schema = makeExecutableSchema({
    typeDefs: [typeDefs, accounts.graphQL.typeDefs],
    resolvers: merge(accounts.graphQL.resolvers, resolvers),
    schemaDirectives: {
      ...accounts.graphQL.schemaDirectives
    }
  })

  const server = new ApolloServer({
    schema,
    context: ({ req }) => accountsContext(req, { accountsServer: accounts.accountsServer }),
    formatError: e => console.log(e) || e
  })

  server.listen(4000).then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`)
  })
}

start()
