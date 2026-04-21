FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
COPY . .
RUN DATABASE_URL="postgresql://placeholder:5432/atlas" npx prisma generate
RUN npm run build
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV="production"
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
