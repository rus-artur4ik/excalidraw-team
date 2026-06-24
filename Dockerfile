FROM --platform=${BUILDPLATFORM} node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production
ARG VITE_APP_FIREBASE_CONFIG
ARG VITE_APP_WS_SERVER_URL
ARG VITE_APP_ACCESS_BACKEND_URL

# bake the self-hosted endpoints into the build; vite reads env from repo root (envDir: "../")
RUN printf "VITE_APP_FIREBASE_CONFIG='%s'\nVITE_APP_WS_SERVER_URL=%s\nVITE_APP_ACCESS_BACKEND_URL=%s\n" \
    "$VITE_APP_FIREBASE_CONFIG" "$VITE_APP_WS_SERVER_URL" "$VITE_APP_ACCESS_BACKEND_URL" \
    > .env.production.local

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
