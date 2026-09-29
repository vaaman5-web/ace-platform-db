FROM node:22-alpine

WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY routes ./routes
COPY services ./services
COPY middleware ./middleware
COPY config ./config
COPY utils ./utils
COPY database ./database
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
