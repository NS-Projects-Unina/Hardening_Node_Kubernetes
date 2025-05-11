FROM node:lts-alpine3.20

WORKDIR /usr/src/app

COPY package*.json ./
COPY server.js ./ 
COPY services/ ./services/
COPY prisma/ ./prisma/
COPY monitors/ ./monitors/
COPY middlewares/ ./middlewares/
COPY libs/ ./libs/
COPY graphql/ ./graphql/

RUN npm install --omit=dev
RUN npx prisma generate

USER 1000

EXPOSE 4000
CMD ["node", "server.js"]