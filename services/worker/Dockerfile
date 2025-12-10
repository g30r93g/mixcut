# services/worker/Dockerfile

# Build L-SMASH and m4acut
FROM amazonlinux:2 AS build

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

# Build m4acut following upstream instructions
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

# Lambda runtime with Node
FROM public.ecr.aws/lambda/nodejs:22

# Copy m4acut
COPY --from=build /opt/m4acut /opt/m4acut
ENV PATH="/opt/m4acut/usr/local/bin:${PATH}"

# Build the worker code inside the image
WORKDIR /repo
ENV CI=true

# Copy only the files needed for the worker + shared workspace packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared ./shared
COPY services/worker ./services/worker

# Install the minimal workspace graph, build shared first, then the worker,
# and finally prune the worker package down to prod dependencies. The filter
# keeps us from building the entire monorepo inside the image.
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter "@mixcut/shared..." --filter "@mixcut/worker..." && \
    pnpm --filter "@mixcut/shared" run build && \
    pnpm --filter "@mixcut/worker" run build && \
    cd services/worker && pnpm prune --prod && \
    cp -r dist/. . && rm -rf dist

# Move built artifacts into Lambda task root
WORKDIR ${LAMBDA_TASK_ROOT}
RUN cp -r /repo/services/worker/. . && \
    rm -rf ./src

CMD [ "index.handler" ]
