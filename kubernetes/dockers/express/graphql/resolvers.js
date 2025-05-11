const { prisma } = require('../prisma/prisma.js');
const { GraphQLError } = require('graphql');

function requireToken(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('Not authorized', { extensions: { code: 'UNAUTHORIZED' } });
  }
}

const resolvers = {
  Query: {
    me: async (_, __, ctx) => {
      requireToken(ctx);
      return await prisma.user.findUnique({
        where: { id: ctx.user.sub },
        include: {
          experiences: true,
          savedExperiences: { include: { experience: true } }
        }
      });
    },
    getMyExperiences: async (_, __, ctx) => {
      requireToken(ctx);
      return await prisma.experience.findMany({
        where: { authorId: ctx.user.sub },
        include: {
          categories: true, author: true
        }
      });
    },
    allPublicExperiences: async (_, { categoryId }) => {
      return await prisma.experience.findMany({
        where: {
          isPrivate: false,
          ...(categoryId ? { categories: { some: { id: categoryId } } } : {})
        },
        include: { author: true, categories: true }
      });
    },
    getSavedExperiences: async (_, __, ctx) => {
      requireToken(ctx);
      const saved = await prisma.savedExperience.findMany({
        where: { userId: ctx.user.sub },
        include: {
          experience: {
            include: {
              categories: true,
              author: true
            }
          }
        }
      });
      const visibleExperiences = saved
        .map(s => s.experience)
        .filter(exp =>
          !exp.isPrivate || exp.authorId === ctx.user.sub
        );
      return visibleExperiences;
    },    
    allCategories: async () => {
      return prisma.category.findMany();
    }
  },
  Mutation: {
    updateProfile: async (_, { bio }, ctx) => {
      requireToken(ctx);
      return prisma.user.update({
        where: { id: ctx.user.sub },
        data: { bio }
      });
    },
    createExperience: async (_, { title, content, categoryIds, isPrivate }, ctx) => {
      requireToken(ctx);
      return prisma.experience.create({
        data: {
          title,
          content,
          isPrivate,
          author: { connect: { id: ctx.user.sub } },
          categories: { connect: categoryIds.map(id => ({ id })) }
        },
        include: { categories: true, author: true }
      });
    },
    updateExperience: async (_, { id, title, content, categoryIds, isPrivate }, ctx) => {
      requireToken(ctx);
      const experience = await prisma.experience.findUnique({ where: { id } });
      if (!experience || experience.authorId !== ctx.user.sub) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'UNAUTHORIZED' }
        });
      }
      const updated = await prisma.experience.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(content && { content }),
          ...(typeof isPrivate === 'boolean' && { isPrivate }),
          ...(categoryIds && {
            categories: {
              set: [],
              connect: categoryIds.map(id => ({ id }))
            }
          })
        },
        include: {
          categories: true,
          author: true
        }
      });
      return updated;
    },
    deleteExperience: async (_, { id }, ctx) => {
      requireToken(ctx);
      const experience = await prisma.experience.findUnique({ where: { id } });
      if (!experience || experience.authorId !== ctx.user.sub) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'UNAUTHORIZED' } });
      }
      await prisma.experience.delete({ where: { id } });
      return true;
    },
    saveExperience: async (_, { experienceId }, ctx) => {
      requireToken(ctx);
      const alreadySaved = await prisma.savedExperience.findUnique({
        where: {
          userId_experienceId: {
            userId: ctx.user.sub,
            experienceId
          }
        }
      });
      if (alreadySaved) {
        throw new GraphQLError('Hai già salvato questa esperienza.', {
          extensions: { code: 'ALREADY_EXISTS' }
        });
      }
      await prisma.savedExperience.create({
        data: {
          user: { connect: { id: ctx.user.sub } },
          experience: { connect: { id: experienceId } }
        }
      });
    
      return true;
    },
    unsaveExperience: async (_, { experienceId }, ctx) => {
      requireToken(ctx);
      try {
        await prisma.savedExperience.delete({
          where: {
            userId_experienceId: {
              userId: ctx.user.sub,
              experienceId
            }
          }
        });
      } catch (error) {
        if (
          error.code === 'P2025' ||
          error.message.includes('Record to delete does not exist')
        ) {
          throw new GraphQLError('Non hai ancora salvato questa esperienza.', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        throw error;
      }
      return true;
    }
  },
  User: {
    experiences: async (parent) => {
      return await prisma.experience.findMany({
        where: { authorId: parent.id },
        include: {
          categories: true,
          author: true
        }
      });
    },
    savedExperiences: async (parent) => {
      const saved = await prisma.savedExperience.findMany({
        where: { userId: parent.id },
        include: {
          experience: {
            include: {
              categories: true,
              author: true
            }
          }
        }
      });

      return saved.map(s => s.experience);
    }
  }
};

module.exports = { resolvers };