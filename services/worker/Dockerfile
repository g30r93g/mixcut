# services/worker/Dockerfile

# Build L-SMASH and m4acut
FROM amazonlinux:2 AS build

ENV INSTALL_ROOT=/opt/m4acut

RUN yum update -y && \
    yum install -y git gcc gcc-c++ make autoconf automake libtool pkgconfig yasm which && \
    yum clean all && rm -rf /var/cache/yum

WORKDIR /build

# Build L-SMASH (dependency of m4acut)
ARG LSMASH_VERSION=v2.14.5
RUN git clone --depth 1 --branch ${LSMASH_VERSION} https://github.com/l-smash/l-smash.git && \
    cd l-smash && \
    ./configure --prefix=/usr/local && \
    make -j"$(nproc)" && \
    make install && \
    make install DESTDIR=${INSTALL_ROOT}

# Build m4acut following upstream instructions
RUN git clone https://github.com/nu774/m4acut.git && \
    cd m4acut && \
    autoreconf -i && \
    ./configure --prefix=/usr/local && \
    make -j"$(nproc)" && \
    make install && \
    make install DESTDIR=${INSTALL_ROOT}

# Lambda runtime with Node
FROM public.ecr.aws/lambda/nodejs:22

# Copy m4acut
COPY --from=build /opt/m4acut /opt/m4acut
ENV PATH="/opt/m4acut/usr/local/bin:${PATH}"

# Build the worker code inside the image
WORKDIR /tmp/build

# Bring in package sources (build context is services/worker)
COPY package.json tsconfig.json ./
COPY src ./src

# Install deps, build, then prune to prod-only.
# Flatten dist into /tmp/build so index.js sits at project root
RUN corepack enable && pnpm install --no-frozen-lockfile && pnpm run build && pnpm prune --prod && \
    cp -r dist/. . && rm -rf dist

# Move built artifacts into Lambda task root
WORKDIR ${LAMBDA_TASK_ROOT}
RUN cp -r /tmp/build/. . && \
    rm -rf ./src

CMD [ "index.handler" ]
