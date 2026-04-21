FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:5432/atlas" npx prisma generate
COPY . .
RUN npm run build
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
