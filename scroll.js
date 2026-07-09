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

  function idSafe(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function tilesetLayerName(tileset) {
    return tileset.split(".").pop();
  }

  function splitDatasetList(value) {
    return value ? value.split(",").map((item) => item.trim()) : [];
  }

  function tilesetConfigsForStep(step, index) {
    const tilesets = splitDatasetList(step.dataset.tilesets || step.dataset.tileset);
    if (!tilesets.length) return [];

    const sourceLayers = splitDatasetList(step.dataset.tilesetLayers || step.dataset.tilesetLayer);
    const layerTypes = splitDatasetList(step.dataset.tilesetTypes || step.dataset.tilesetType);
    const colors = splitDatasetList(step.dataset.tilesetColors || step.dataset.tilesetColor);
    const opacities = splitDatasetList(step.dataset.tilesetOpacities || step.dataset.tilesetOpacity);
    const rasterColors = splitDatasetList(step.dataset.tilesetRasterColors || step.dataset.tilesetRasterColor);
    const hueRotates = splitDatasetList(step.dataset.tilesetHueRotates || step.dataset.tilesetHueRotate);
    const saturations = splitDatasetList(step.dataset.tilesetSaturations || step.dataset.tilesetSaturation);
    const contrasts = splitDatasetList(step.dataset.tilesetContrasts || step.dataset.tilesetContrast);
    const brightnessMins = splitDatasetList(step.dataset.tilesetBrightnessMins || step.dataset.tilesetBrightnessMin);
    const brightnessMaxes = splitDatasetList(step.dataset.tilesetBrightnessMaxes || step.dataset.tilesetBrightnessMax);

    return tilesets.map((tileset, tilesetIndex) => {
      const layerType = layerTypes[tilesetIndex] || layerTypes[0] || "fill";
      const color = colors[tilesetIndex] || colors[0] || "#c77836";
      const opacity = Number.parseFloat(opacities[tilesetIndex] || opacities[0]);
      const hueRotate = Number.parseFloat(hueRotates[tilesetIndex] || hueRotates[0]);
      const saturation = Number.parseFloat(saturations[tilesetIndex] || saturations[0]);
      const contrast = Number.parseFloat(contrasts[tilesetIndex] || contrasts[0]);
      const brightnessMin = Number.parseFloat(brightnessMins[tilesetIndex] || brightnessMins[0]);
      const brightnessMax = Number.parseFloat(brightnessMaxes[tilesetIndex] || brightnessMaxes[0]);
      const sourceId = `story-step-source-${idSafe(tileset)}`;
      const layerId = `story-step-layer-${index}-${tilesetIndex}-${idSafe(tileset)}`;

      return {
        tileset,
        sourceId,
        layerId,
        sourceLayer: sourceLayers[tilesetIndex] || tilesetLayerName(tileset),
        layerType,
        color,
        opacity: Number.isFinite(opacity) ? opacity : null,
        rasterColor: rasterColors[tilesetIndex] || rasterColors[0] || null,
        hueRotate: Number.isFinite(hueRotate) ? hueRotate : null,
        saturation: Number.isFinite(saturation) ? saturation : null,
        contrast: Number.isFinite(contrast) ? contrast : null,
        brightnessMin: Number.isFinite(brightnessMin) ? brightnessMin : null,
        brightnessMax: Number.isFinite(brightnessMax) ? brightnessMax : null,
      };
    });
  }

  function placeholderConfigForStep(step, index) {
    const placeholder = step.dataset.placeholderLayer;
    if (!placeholder) return null;

    const layerType = step.dataset.placeholderType || "fill";
    const color = step.dataset.placeholderColor || "#c77836";
    const sourceId = `story-placeholder-source-${index}-${idSafe(placeholder)}`;
    const layerId = `story-placeholder-layer-${index}-${idSafe(placeholder)}`;

    return {
      sourceId,
      layerId,
      layerType,
      color,
      size: Number.parseFloat(step.dataset.placeholderSize) || 0.04,
      center: parseCenter(step.dataset.center),
    };
  }

  function opacityProperty(layerType) {
    if (layerType === "raster") return "raster-opacity";
    if (layerType === "line") return "line-opacity";
    if (layerType === "circle") return "circle-opacity";
    return "fill-opacity";
  }

  function colorProperty(layerType) {
    if (layerType === "raster") return null;
    if (layerType === "line") return "line-color";
    if (layerType === "circle") return "circle-color";
    return "fill-color";
  }

  function placeholderData(config) {
    const [lng, lat] = config.center;
    const size = config.size;

    if (config.layerType === "line") {
      return {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [lng - size * 1.4, lat - size * 0.55],
              [lng - size * 0.45, lat - size * 0.18],
              [lng + size * 0.2, lat + size * 0.05],
              [lng + size * 1.35, lat + size * 0.55],
            ],
          },
        }],
      };
    }

    if (config.layerType === "circle") {
      return {
        type: "FeatureCollection",
        features: [-0.8, -0.35, 0.1, 0.55, 0.95].map((offset, pointIndex) => ({
          type: "Feature",
          properties: { id: pointIndex },
          geometry: {
            type: "Point",
            coordinates: [lng + size * offset, lat + size * Math.sin(pointIndex + 1) * 0.45],
          },
        })),
      };
    }

    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lng - size, lat - size * 0.65],
            [lng + size * 0.9, lat - size * 0.55],
            [lng + size, lat + size * 0.68],
            [lng - size * 0.85, lat + size * 0.58],
            [lng - size, lat - size * 0.65],
          ]],
        },
      }],
    };
  }

  function paintForConfig(config) {
    const paint = {
      [opacityProperty(config.layerType)]: 0,
    };
    const colorKey = colorProperty(config.layerType);

    if (colorKey) {
      paint[colorKey] = config.color;
    }

    if (config.layerType === "line") {
      paint["line-width"] = 4;
    }

    if (config.layerType === "raster") {
      if (config.rasterColor) {
        paint["raster-color"] = [
          "interpolate",
          ["linear"],
          ["raster-value"],
          0,
          config.rasterColor,
          1,
          config.rasterColor,
        ];
        paint["raster-color-range"] = [0, 1];
      }

      if (config.hueRotate !== null) paint["raster-hue-rotate"] = config.hueRotate;
      if (config.saturation !== null) paint["raster-saturation"] = config.saturation;
      if (config.contrast !== null) paint["raster-contrast"] = config.contrast;
      if (config.brightnessMin !== null) paint["raster-brightness-min"] = config.brightnessMin;
      if (config.brightnessMax !== null) paint["raster-brightness-max"] = config.brightnessMax;
    }

    if (config.layerType === "circle") {
      paint["circle-radius"] = 7;
      paint["circle-stroke-color"] = "#ffffff";
      paint["circle-stroke-width"] = 1.5;
      paint["circle-stroke-opacity"] = 0;
    }

    return paint;
  }

  function addStepTilesets(map, steps) {
    steps.forEach((step, index) => {
      tilesetConfigsForStep(step, index).forEach((config) => {
        if (!map.getSource(config.sourceId)) {
          map.addSource(
            config.sourceId,
            config.layerType === "raster"
              ? {
                  type: "raster",
                  url: `mapbox://${config.tileset}`,
                  tileSize: 256,
                }
              : {
                  type: "vector",
                  url: `mapbox://${config.tileset}`,
                },
          );
        }

        if (map.getLayer(config.layerId)) return;

        const layer = {
          id: config.layerId,
          type: config.layerType,
          source: config.sourceId,
          paint: paintForConfig(config),
        };

        if (config.layerType !== "raster") {
          layer["source-layer"] = config.sourceLayer;
        }

        map.addLayer(layer);

        map.setPaintProperty(config.layerId, `${opacityProperty(config.layerType)}-transition`, {
          duration: 700,
          delay: 0,
        });
      });
    });
  }

  function addStepPlaceholders(map, steps) {
    steps.forEach((step, index) => {
      const config = placeholderConfigForStep(step, index);
      if (!config) return;

      if (!map.getSource(config.sourceId)) {
        map.addSource(config.sourceId, {
          type: "geojson",
          data: placeholderData(config),
        });
      }

      if (map.getLayer(config.layerId)) return;

      map.addLayer({
        id: config.layerId,
        type: config.layerType,
        source: config.sourceId,
        paint: paintForConfig(config),
      });

      map.setPaintProperty(config.layerId, `${opacityProperty(config.layerType)}-transition`, {
        duration: 700,
        delay: 0,
      });
    });
  }

  function updateStepTilesets(map, steps, activeStep) {
    steps.forEach((step, index) => {
      const placeholderConfig = placeholderConfigForStep(step, index);
      const configs = [
        ...tilesetConfigsForStep(step, index),
        ...(placeholderConfig ? [placeholderConfig] : []),
      ];

      configs.forEach((config) => {
        if (!map.getLayer(config.layerId)) return;

        const activeOpacity = config.opacity ?? (config.layerType === "raster" || config.layerType === "line" ? 0.85 : 0.55);
        map.setPaintProperty(
          config.layerId,
          opacityProperty(config.layerType),
          step === activeStep ? activeOpacity : 0,
        );

        if (config.layerType === "circle") {
          map.setPaintProperty(
            config.layerId,
            "circle-stroke-opacity",
            step === activeStep ? activeOpacity : 0,
          );
        }
      });
    });
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
    let activeStep = steps[0];

    function setActiveStep(step) {
      activeStep = step;

      steps.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === step);
      });

      if (!map) return;

      map.flyTo({
        ...cameraForStep(step),
        duration: 6400,
        curve: 1.5,
        essential: true,
      });

      updateStepTilesets(map, steps, step);
    }

    if (window.mapboxgl && scrolly.dataset.mapboxToken) {
      mapboxgl.accessToken = scrolly.dataset.mapboxToken;

      map = new mapboxgl.Map({
        container: mapContainer,
        style: scrolly.dataset.mapboxStyle || "mapbox://styles/daltonwb/cmrdued7y000l01s7fnbtdf41",
        ...cameraForStep(steps[0]),
        interactive: false,
        attributionControl: true,
      });

      map.on("load", () => {
        mapContainer.classList.add("is-ready");
        addStepTilesets(map, steps);
        addStepPlaceholders(map, steps);
        updateStepTilesets(map, steps, activeStep);
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
