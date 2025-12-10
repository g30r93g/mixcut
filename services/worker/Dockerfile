# services/worker/Dockerfile

# Stage 1: build and package the native audio tooling we need (m4acut + AtomicParsley)
FROM amazonlinux:2 AS tools-build

ENV INSTALL_ROOT=/opt/m4acut

RUN yum update -y && \
    yum install -y git gcc gcc-c++ make autoconf automake libtool pkgconfig yasm which curl unzip && \
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

# Build m4acut
RUN git clone https://github.com/nu774/m4acut.git && \
    cd m4acut && \
    autoreconf -i && \
    ./configure --prefix=/usr/local && \
    make -j"$(nproc)" && \
    make install && \
    make install DESTDIR=${INSTALL_ROOT}

# Install AtomicParsley release binary
ARG ATOMICPARSLEY_VERSION=20240608.083822.1ed9031
RUN curl -L -o AtomicParsleyLinux.zip https://github.com/wez/atomicparsley/releases/download/${ATOMICPARSLEY_VERSION}/AtomicParsleyLinux.zip && \
    unzip AtomicParsleyLinux.zip && \
    install -m 0755 AtomicParsley /usr/local/bin/AtomicParsley && \
    mkdir -p ${INSTALL_ROOT}/usr/local/bin && \
    install -m 0755 AtomicParsley ${INSTALL_ROOT}/usr/local/bin/AtomicParsley && \
    rm -f AtomicParsley AtomicParsleyLinux.zip


FROM public.ecr.aws/lambda/nodejs:22

# Bring the native tooling compiled in the first stage into the runtime layer
COPY --from=tools-build /usr/local/ /usr/local/

COPY package.json tsconfig.json ./
COPY src ./src

# Install deps, build, then prune to prod-only.
# Flatten dist into /tmp/build so index.js sits at project root
RUN corepack enable && pnpm install --no-frozen-lockfile && pnpm run build && pnpm prune --prod && \
    cp -r dist/. . && rm -rf dist && \
    mkdir -p /tmp/build && \
    cp -r . /tmp/build

# Move built artifacts into Lambda task root
WORKDIR ${LAMBDA_TASK_ROOT}
RUN cp -r /tmp/build/. . && \
    rm -rf ./src

CMD [ "index.handler" ]
