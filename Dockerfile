FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:5432/atlas" npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
