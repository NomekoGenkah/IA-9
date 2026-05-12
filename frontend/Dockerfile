FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# VITE_API_TARGET is injected at container start by docker-compose
CMD ["npm", "run", "dev"]
