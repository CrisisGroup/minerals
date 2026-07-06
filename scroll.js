(function () {
  const swaps = Array.from(document.querySelectorAll("[data-scroll-swap]"));
  if (!swaps.length) return;

  const DEFAULT_FADE_DURATION_MS = 360;
  const DEFAULT_FINAL_HOLD_RATIO = 0.45;
  const DEFAULT_TRIGGER_LINE_RATIO = 0.88;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function getLabels(swap) {
    const track = swap.querySelector(".scroll-swap__track");
    const labels = track && track.dataset.labels
      ? track.dataset.labels.split("|").map((label) => label.trim()).filter(Boolean)
      : [];

    return labels.length ? labels : ["Before", "After"];
  }

  function getFadeDuration(swap) {
    const requestedDuration = Number.parseInt(swap.dataset.swapFadeMs, 10);
    return Number.isFinite(requestedDuration) && requestedDuration >= 0
      ? requestedDuration
      : DEFAULT_FADE_DURATION_MS;
  }

  function getFinalHoldRatio(swap, labels) {
    const requestedHold = Number.parseFloat(swap.dataset.swapFinalHold);

    if (Number.isFinite(requestedHold)) {
      return Math.min(Math.max(requestedHold, 0), 0.85);
    }

    return labels.length >= 3 ? DEFAULT_FINAL_HOLD_RATIO : 0;
  }

  function getTriggerLine(swap) {
    const requestedTrigger = Number.parseFloat(swap.dataset.swapTrigger);
    const triggerRatio = Number.isFinite(requestedTrigger)
      ? Math.min(Math.max(requestedTrigger, 0.1), 0.95)
      : DEFAULT_TRIGGER_LINE_RATIO;

    return window.innerHeight * triggerRatio;
  }

  function getProgressTrackTop(swap, trackRect) {
    const stage = swap.querySelector(".scroll-swap__stage");
    if (!stage) return trackRect.top;

    const swapRect = swap.getBoundingClientRect();
    const stickyOffset = Number.parseFloat(window.getComputedStyle(stage).top) || 0;
    const viewportStageHeight = Math.max(window.innerHeight - stickyOffset, 1);
    return Math.min(trackRect.top, swapRect.top + viewportStageHeight);
  }

  function applyFrame(swap, nextIndex) {
    const labels = getLabels(swap);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), labels.length - 1);

    if (Number.parseInt(swap.dataset.swapIndex, 10) === clampedIndex) return;

    const frame = swap.querySelector(".scroll-swap__frame");
    const label = swap.querySelector(".scroll-swap__label");
    if (!frame || !label) return;

    swap.dataset.swapIndex = String(clampedIndex);
    frame.style.setProperty("--frame-progress", clampedIndex / Math.max(labels.length - 1, 1));

    if (prefersReducedMotion.matches) {
      label.innerHTML = labelText(frame, labels[clampedIndex]);
      return;
    }

    frame.classList.add("is-changing");
    window.clearTimeout(swap.__swapCleanupTimer);

    window.setTimeout(() => {
      label.innerHTML = labelText(frame, labels[clampedIndex]);
      frame.classList.remove("is-changing");
    }, Math.min(getFadeDuration(swap) / 2, 160));

    swap.__swapCleanupTimer = window.setTimeout(() => {
      frame.classList.remove("is-changing");
    }, getFadeDuration(swap));
  }

  function labelText(frame, frameLabel) {
    const title = frame.dataset.frameTitle || "Scroll-Swap";
    return `${title}<br />${frameLabel}`;
  }

  function updateSwaps() {
    swaps.forEach((swap) => {
      const track = swap.querySelector(".scroll-swap__track");
      if (!track) return;

      const labels = getLabels(swap);
      const trackRect = track.getBoundingClientRect();
      const progressTrackTop = getProgressTrackTop(swap, trackRect);
      const triggerLine = getTriggerLine(swap);
      const trackHeight = Math.max(trackRect.height, 1);
      const trackProgress = Math.min(Math.max((triggerLine - progressTrackTop) / trackHeight, 0), 0.999);
      const finalHoldRatio = getFinalHoldRatio(swap, labels);
      const transitionProgress = finalHoldRatio > 0
        ? Math.min(trackProgress / (1 - finalHoldRatio), 0.999)
        : trackProgress;
      const nextIndex = progressTrackTop <= triggerLine
        ? Math.min(Math.floor(transitionProgress * (labels.length - 1)) + 1, labels.length - 1)
        : 0;

      applyFrame(swap, nextIndex);
    });

    ticking = false;
  }

  let ticking = false;

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateSwaps);
  }

  swaps.forEach((swap) => {
    const labels = getLabels(swap);
    const requestedIndex = Number.parseInt(swap.dataset.swapIndex, 10);
    const initialIndex = Number.isInteger(requestedIndex)
      ? Math.min(Math.max(requestedIndex, 0), labels.length - 1)
      : 0;

    swap.dataset.swapIndex = "-1";
    applyFrame(swap, initialIndex);
  });

  requestUpdate();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
})();

(function () {
  const scrolly = document.querySelector("[data-map-scrolly]");
  if (!scrolly) return;

  const map = scrolly.querySelector(".mock-mapbox");
  const mapLabel = scrolly.querySelector(".mock-mapbox__label");
  const steps = Array.from(scrolly.querySelectorAll(".map-scrolly__step"));
  if (!map || !mapLabel || !steps.length) return;

  function setActiveStep(step) {
    steps.forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === step);
    });

    map.dataset.mapState = step.dataset.mapState || "overview";
    mapLabel.textContent = step.dataset.mapLabel || step.querySelector("h3")?.textContent || "Map State";
  }

  if (!("IntersectionObserver" in window)) {
    setActiveStep(steps[0]);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      .slice(0, 1)
      .forEach((entry) => setActiveStep(entry.target));
  }, {
    root: null,
    rootMargin: "-35% 0px -35% 0px",
    threshold: [0.2, 0.45, 0.7],
  });

  steps.forEach((step) => observer.observe(step));
  setActiveStep(steps[0]);
})();

(function () {
  const scrollys = Array.from(document.querySelectorAll("[data-story-map]"));
  if (!scrollys.length) return;

  function parseCenter(value) {
    const fallback = [96.5, 24.6];
    if (!value) return fallback;

    const center = value.split(",").map((coordinate) => Number.parseFloat(coordinate.trim()));
    return center.length === 2 && center.every(Number.isFinite) ? center : fallback;
  }

  function cameraForStep(step) {
    return {
      center: parseCenter(step.dataset.center),
      zoom: Number.parseFloat(step.dataset.zoom) || 5.4,
      pitch: Number.parseFloat(step.dataset.pitch) || 0,
      bearing: Number.parseFloat(step.dataset.bearing) || 0,
    };
  }

  scrollys.forEach((scrolly) => {
    const mapContainer = scrolly.querySelector(".story-mapbox");
    const fallback = scrolly.querySelector(".story-mapbox__fallback span");
    const steps = Array.from(scrolly.querySelectorAll(".story-mapbox-scrolly__step"));
    if (!mapContainer || !steps.length) return;

    if (fallback && scrolly.dataset.mapboxFallback) {
      fallback.textContent = scrolly.dataset.mapboxFallback;
    }

    let map = null;

    function setActiveStep(step) {
      steps.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === step);
      });

      if (!map) return;

      map.easeTo({
        ...cameraForStep(step),
        duration: 900,
        essential: true,
      });
    }

    if (window.mapboxgl && scrolly.dataset.mapboxToken) {
      mapboxgl.accessToken = scrolly.dataset.mapboxToken;

      map = new mapboxgl.Map({
        container: mapContainer,
        style: scrolly.dataset.mapboxStyle || "mapbox://styles/daltonwb/cmqksn2k7001u01s3h9r2agnp",
        ...cameraForStep(steps[0]),
        interactive: false,
        attributionControl: true,
      });

      map.on("load", () => {
        mapContainer.classList.add("is-ready");
      });
    }

    if (!("IntersectionObserver" in window)) {
      setActiveStep(steps[0]);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        .slice(0, 1)
        .forEach((entry) => setActiveStep(entry.target));
    }, {
      root: null,
      rootMargin: "-38% 0px -38% 0px",
      threshold: [0.2, 0.45, 0.7],
    });

    steps.forEach((step) => observer.observe(step));
    setActiveStep(steps[0]);
  });
})();
