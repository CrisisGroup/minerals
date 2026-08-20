(function () {
  "use strict";

  var videos = document.querySelectorAll("video[autoplay]");
  if (!videos.length) return;

  var reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };
  var fallbackDelay = 3200;
  var visibilityTicking = false;
  var requestFrame = window.requestAnimationFrame || function (callback) {
    return window.setTimeout(callback, 16);
  };

  function forEachVideo(callback) {
    Array.prototype.forEach.call(videos, callback);
  }

  function getState(video) {
    return video.getAttribute("data-autoplay-state") || "idle";
  }

  function getFallbackContainer(video) {
    var node = video.parentNode;

    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.hasAttribute("data-autoplay-fallback")) return node;
      node = node.parentNode;
    }

    return null;
  }

  function updateFallbackControl(video, state) {
    var container = getFallbackContainer(video);
    if (!container) return;

    var button = container.querySelector("[data-autoplay-play]");
    var label = container.querySelector("[data-autoplay-play-label]");
    if (!button || !label) return;

    container.setAttribute("data-autoplay-state", state);

    if (state === "blocked" || state === "manual") {
      button.removeAttribute("hidden");
      button.disabled = false;
      label.textContent = "Play animation";
      return;
    }

    if (state === "requesting") {
      button.removeAttribute("hidden");
      button.disabled = true;
      label.textContent = "Starting...";
      return;
    }

    if (state === "unavailable") {
      button.removeAttribute("hidden");
      button.disabled = true;
      label.textContent = "Video unavailable";
      return;
    }

    button.setAttribute("hidden", "");
    button.disabled = false;
    label.textContent = "Play animation";
  }

  function setState(video, state) {
    video.setAttribute("data-autoplay-state", state);
    updateFallbackControl(video, state);
  }

  function clearLegacyTimer(video) {
    if (!video._mineralsAutoplayTimer) return;
    window.clearTimeout(video._mineralsAutoplayTimer);
    video._mineralsAutoplayTimer = null;
  }

  function isVisible(video) {
    if (document.visibilityState === "hidden") return false;

    var rect = video.getBoundingClientRect();
    return rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
  }

  function isSuppressed(video) {
    var state = getState(video);
    return state === "blocked" || state === "manual" || state === "unavailable";
  }

  function showStaticFallback(video, state) {
    clearLegacyTimer(video);
    video._mineralsPlayPending = false;
    video._mineralsUserPlayback = false;
    video.removeAttribute("autoplay");
    video.pause();
    setState(video, state);
  }

  function handlePlayFailure(video, error) {
    clearLegacyTimer(video);
    video._mineralsPlayPending = false;

    if (error && error.name === "AbortError") {
      if (getState(video) === "requesting") setState(video, "blocked");
      return false;
    }

    if ((error && error.name === "NotSupportedError")
      || (video.error && video.error.code === 4)) {
      showStaticFallback(video, "unavailable");
      return false;
    }

    showStaticFallback(video, "blocked");
    return false;
  }

  function verifyLegacyPlayback(video) {
    clearLegacyTimer(video);

    video._mineralsAutoplayTimer = window.setTimeout(function () {
      video._mineralsAutoplayTimer = null;
      video._mineralsPlayPending = false;

      if (!video.paused && !video.ended) {
        setState(video, "playing");
        return;
      }

      if (isVisible(video)) showStaticFallback(video, "blocked");
    }, fallbackDelay);
  }

  function request(video, userInitiated) {
    var state;
    var playRequest;

    if (!video) return false;

    state = getState(video);
    if (!userInitiated && reducedMotion.matches && !video._mineralsUserPlayback) {
      showStaticFallback(video, "manual");
      return false;
    }

    if (state === "unavailable" || (!userInitiated && isSuppressed(video))) return false;
    if (video._mineralsPlayPending || (!video.paused && !video.ended)) return true;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    if (userInitiated) {
      video._mineralsUserPlayback = true;
      video.setAttribute("autoplay", "");
      setState(video, "requesting");
    }

    video._mineralsPlayPending = true;

    try {
      playRequest = video.play();
    } catch (error) {
      return handlePlayFailure(video, error);
    }

    if (playRequest && typeof playRequest.then === "function") {
      playRequest.then(function () {
        video._mineralsPlayPending = false;
        setState(video, video.paused ? "idle" : "playing");
      }, function (error) {
        handlePlayFailure(video, error);
      });
    } else {
      verifyLegacyPlayback(video);
    }

    return true;
  }

  function pause(video) {
    if (!video) return;

    clearLegacyTimer(video);
    video._mineralsPlayPending = false;
    video._mineralsUserPlayback = false;
    video.pause();

    if (!isSuppressed(video)) setState(video, "idle");
  }

  function prepareVideo(video) {
    var container;
    var button;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");

    video.addEventListener("playing", function () {
      clearLegacyTimer(video);
      video._mineralsPlayPending = false;
      setState(video, "playing");
    });

    video.addEventListener("error", function () {
      showStaticFallback(video, "unavailable");
    });

    container = getFallbackContainer(video);
    button = container ? container.querySelector("[data-autoplay-play]") : null;
    if (button) {
      button.addEventListener("click", function () {
        request(video, true);
      });
    }

    if (reducedMotion.matches) {
      showStaticFallback(video, "manual");
    } else if (!video.paused && !video.ended) {
      setState(video, "playing");
    } else {
      setState(video, "idle");
    }
  }

  function updateVisibleVideos() {
    visibilityTicking = false;

    forEachVideo(function (video) {
      if (isVisible(video)) {
        request(video, false);
      } else {
        pause(video);
      }
    });
  }

  function requestVisibilityUpdate() {
    if (visibilityTicking) return;
    visibilityTicking = true;
    requestFrame(updateVisibleVideos);
  }

  function handleMotionPreference() {
    forEachVideo(function (video) {
      if (reducedMotion.matches) {
        showStaticFallback(video, "manual");
      } else if (getState(video) === "manual") {
        setState(video, "idle");
        video.setAttribute("autoplay", "");
      }
    });

    requestVisibilityUpdate();
  }

  forEachVideo(prepareVideo);

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", handleMotionPreference);
  } else if (typeof reducedMotion.addListener === "function") {
    reducedMotion.addListener(handleMotionPreference);
  }

  window.addEventListener("scroll", requestVisibilityUpdate, false);
  window.addEventListener("resize", requestVisibilityUpdate);
  document.addEventListener("visibilitychange", requestVisibilityUpdate);

  window.mineralsVideoPlayback = {
    request: request,
    pause: pause,
    isSuppressed: isSuppressed
  };

  requestVisibilityUpdate();
})();
