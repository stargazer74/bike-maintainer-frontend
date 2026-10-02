# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Requires src/app/api-client to already exist in the build context — it's
# gitignored and generated from the sibling bike-maintainer-api repo's spec
# via `npm run generate:api` (see CLAUDE.md). Run that before `docker build`.
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/bike-maintainer-frontend/browser /usr/share/nginx/html

EXPOSE 80
