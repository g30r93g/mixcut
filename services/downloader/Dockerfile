# services/downloader/Dockerfile

FROM public.ecr.aws/lambda/nodejs:22

# Install yt-dlp and ffmpeg for muxing audio-only formats
RUN yum update -y \
  && yum install -y python3-pip ffmpeg \
  && pip3 install --no-cache-dir yt-dlp \
  && yum clean all && rm -rf /var/cache/yum

# Build the downloader code inside the image
WORKDIR /tmp/build
COPY package.json tsconfig.json ./
COPY src ./src

RUN corepack enable \
  && pnpm install --no-frozen-lockfile \
  && pnpm run build \
  && pnpm prune --prod \
  && cp -r dist/. . \
  && rm -rf dist

# Move built artifacts into Lambda task root
WORKDIR ${LAMBDA_TASK_ROOT}
RUN cp -r /tmp/build/. . && rm -rf /tmp/build

CMD ["index.handler"]
