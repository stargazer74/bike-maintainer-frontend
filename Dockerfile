# syntax=docker/dockerfile:1

# The build output is static files, so this stage always runs natively on the build machine ($BUILDPLATFORM) instead
# of under emulation; only the nginx stage below is built per target platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Requires src/app/api-client to already exist in the build context — it's
# gitignored and generated from the sibling bike-maintainer-api repo's spec
# via `npm run generate:api` (see CLAUDE.md). Run that before `docker build`.
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
# Backend address for /api/ (host:port in the Docker network) and the DNS resolver used to look it up at request
# time (127.0.0.11 is Docker's embedded DNS). Both can be overridden per container.
ENV BACKEND_HOST=bike-maintainer-backend:8080 \
    NGINX_RESOLVER=127.0.0.11
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/bike-maintainer-frontend/browser /usr/share/nginx/html

EXPOSE 80
