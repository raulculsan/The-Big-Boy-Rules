# syntax=docker/dockerfile:1
# Entorno de compilación unificado de The Big Boy Rules: web (Node) + Android.
# iOS no puede compilarse en contenedores Linux: sigue en macOS/Xcode.
#
# Se fija linux/amd64 porque las build-tools del Android SDK para Linux solo
# se publican para x86_64. En Mac con Apple Silicon corre con Rosetta.
FROM --platform=linux/amd64 node:22-trixie

ARG ANDROID_PLATFORM=android-36
ARG ANDROID_BUILD_TOOLS=36.0.0
ARG ANDROID_CMDLINE_TOOLS=13114758

ENV DEBIAN_FRONTEND=noninteractive \
    JAVA_HOME=/opt/java/openjdk \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/gradle
ENV PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

# JDK 21 (el que exige capacitor.build.gradle), copiado de la imagen oficial de Temurin.
COPY --from=eclipse-temurin:21-jdk /opt/java/openjdk /opt/java/openjdk

# Herramientas de imagen del build web: ImageMagick (`magick`) y Python + Pillow.
RUN apt-get update \
 && apt-get install -y --no-install-recommends imagemagick python3 python3-pil unzip git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && (command -v magick >/dev/null || ln -s "$(command -v convert)" /usr/local/bin/magick)

# Android SDK: solo lo necesario para compilar (sin emulador).
RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
 && curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip" \
 && unzip -q /tmp/cmdline-tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
 && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
 && rm /tmp/cmdline-tools.zip \
 && yes | sdkmanager --licenses >/dev/null \
 && sdkmanager --install "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}" >/dev/null

WORKDIR /workspace
