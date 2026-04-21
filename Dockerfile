FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:5432/atlas" npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["npm", "start"]
