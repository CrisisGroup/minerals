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
  const MAP_LABEL_FONT_STACK = ["Franklin Gothic Medium Regular", "Arial Unicode MS Regular"];
  const MAP_LABEL_ITALIC_FONT_STACK = ["Franklin Gothic Medium Italic", "Arial Unicode MS Regular"];

  function parseCenter(value) {
    const fallback = [96.5, 24.6];
    if (!value) return fallback;

    const center = value.split(",").map((coordinate) => Number.parseFloat(coordinate.trim()));
    return center.length === 2 && center.every(Number.isFinite) ? center : fallback;
  }

  function parseAdditionalLabels(value) {
    if (!value) return [];

    try {
      const labels = JSON.parse(value);
      if (!Array.isArray(labels)) return [];

      return labels.filter((label) => (
        typeof label?.text === "string"
        && Array.isArray(label.center)
        && label.center.length === 2
        && label.center.every(Number.isFinite)
      ));
    } catch {
      return [];
    }
  }

  function cameraForStep(step) {
    return {
      center: parseCenter(step.dataset.center),
      zoom: Number.parseFloat(step.dataset.zoom) || 5.4,
      pitch: Number.parseFloat(step.dataset.pitch) || 0,
      bearing: Number.parseFloat(step.dataset.bearing) || 0,
    };
  }

  function stepForViewport(scrolly, steps) {
    const triggerLine = window.innerHeight * 0.5;
    const scrollyRect = scrolly.getBoundingClientRect();

    if (scrollyRect.top > triggerLine) return steps[0];
    if (scrollyRect.bottom < triggerLine) return steps[steps.length - 1];

    const stepRects = steps.map((step) => ({
      step,
      rect: step.getBoundingClientRect(),
    }));

    const active = stepRects.find(({ rect }) => (
      rect.top <= triggerLine && rect.bottom >= triggerLine
    ));

    if (active) return active.step;
    if (stepRects[0].rect.top > triggerLine) return steps[0];
    if (stepRects[stepRects.length - 1].rect.bottom < triggerLine) {
      return steps[steps.length - 1];
    }

    return stepRects.reduce((nearest, candidate) => {
      const nearestDistance = Math.abs(
        nearest.rect.top + nearest.rect.height / 2 - triggerLine,
      );
      const candidateDistance = Math.abs(
        candidate.rect.top + candidate.rect.height / 2 - triggerLine,
      );

      return candidateDistance < nearestDistance ? candidate : nearest;
    }).step;
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

    let layerFilters = [];
    try {
      const parsedFilters = JSON.parse(step.dataset.tilesetFilters || "[]");
      layerFilters = Array.isArray(parsedFilters) ? parsedFilters : [];
    } catch {
      layerFilters = [];
    }

    const sourceLayers = splitDatasetList(step.dataset.tilesetLayers || step.dataset.tilesetLayer);
    const layerTypes = splitDatasetList(step.dataset.tilesetTypes || step.dataset.tilesetType);
    const colors = splitDatasetList(step.dataset.tilesetColors || step.dataset.tilesetColor);
    const strokeColors = splitDatasetList(step.dataset.tilesetStrokeColors || step.dataset.tilesetStrokeColor);
    const opacities = splitDatasetList(step.dataset.tilesetOpacities || step.dataset.tilesetOpacity);
    const rasterColors = splitDatasetList(step.dataset.tilesetRasterColors || step.dataset.tilesetRasterColor);
    const hueRotates = splitDatasetList(step.dataset.tilesetHueRotates || step.dataset.tilesetHueRotate);
    const saturations = splitDatasetList(step.dataset.tilesetSaturations || step.dataset.tilesetSaturation);
    const contrasts = splitDatasetList(step.dataset.tilesetContrasts || step.dataset.tilesetContrast);
    const brightnessMins = splitDatasetList(step.dataset.tilesetBrightnessMins || step.dataset.tilesetBrightnessMin);
    const brightnessMaxes = splitDatasetList(step.dataset.tilesetBrightnessMaxes || step.dataset.tilesetBrightnessMax);
    const lineWidths = splitDatasetList(step.dataset.tilesetLineWidths || step.dataset.tilesetLineWidth);
    const adminLevels = splitDatasetList(step.dataset.tilesetAdminLevels || step.dataset.tilesetAdminLevel);
    const adminCountries = splitDatasetList(step.dataset.tilesetAdminCountries || step.dataset.tilesetAdminCountry);
    const adminWorldviews = splitDatasetList(step.dataset.tilesetAdminWorldviews || step.dataset.tilesetAdminWorldview);
    const adminDisputed = splitDatasetList(step.dataset.tilesetAdminDisputed);
    const labels = splitDatasetList(step.dataset.tilesetLabels);
    const labelModes = splitDatasetList(step.dataset.tilesetLabelModes);
    const labelSizes = splitDatasetList(step.dataset.tilesetLabelSizes);
    const labelStyles = splitDatasetList(step.dataset.tilesetLabelStyles);
    const labelColors = splitDatasetList(step.dataset.tilesetLabelColors);
    const labelHaloWidths = splitDatasetList(step.dataset.tilesetLabelHaloWidths);
    const labelLetterSpacings = splitDatasetList(step.dataset.tilesetLabelLetterSpacings);

    return tilesets.map((tileset, tilesetIndex) => {
      const layerType = layerTypes[tilesetIndex] || layerTypes[0] || "fill";
      const color = colors[tilesetIndex] || colors[0] || "#c77836";
      const opacity = Number.parseFloat(opacities[tilesetIndex] || opacities[0]);
      const hueRotate = Number.parseFloat(hueRotates[tilesetIndex] || hueRotates[0]);
      const saturation = Number.parseFloat(saturations[tilesetIndex] || saturations[0]);
      const contrast = Number.parseFloat(contrasts[tilesetIndex] || contrasts[0]);
      const brightnessMin = Number.parseFloat(brightnessMins[tilesetIndex] || brightnessMins[0]);
      const brightnessMax = Number.parseFloat(brightnessMaxes[tilesetIndex] || brightnessMaxes[0]);
      const lineWidth = Number.parseFloat(lineWidths[tilesetIndex] || lineWidths[0]);
      const adminLevel = Number.parseFloat(adminLevels[tilesetIndex] || adminLevels[0]);
      const labelSize = Number.parseFloat(labelSizes[tilesetIndex]);
      const labelHaloWidth = Number.parseFloat(labelHaloWidths[tilesetIndex]);
      const labelLetterSpacing = Number.parseFloat(labelLetterSpacings[tilesetIndex]);
      const perTilesetLabel = labels[tilesetIndex] || null;
      const hasStepLabel = step.dataset.mapLabel
        && (!step.dataset.mapLabelTileset || step.dataset.mapLabelTileset === tileset);
      const labelText = perTilesetLabel || (hasStepLabel ? step.dataset.mapLabel : null);
      const labelMode = labelText
        ? labelModes[tilesetIndex] || step.dataset.mapLabelMode || "centroid"
        : null;
      const labelCenter = labelText && step.dataset.mapLabelCenter
        ? parseCenter(step.dataset.mapLabelCenter)
        : null;
      const fixedLabels = labelMode === "fixed"
        ? [
            ...(labelCenter ? [{ text: labelText, center: labelCenter }] : []),
            ...parseAdditionalLabels(step.dataset.mapLabelAdditions),
          ]
        : [];
      const sourceId = `story-step-source-${idSafe(tileset)}`;
      const layerId = `story-step-layer-${index}-${tilesetIndex}-${idSafe(tileset)}`;

      return {
        tileset,
        sourceId,
        layerId,
        sourceLayer: sourceLayers[tilesetIndex] || tilesetLayerName(tileset),
        layerType,
        color,
        strokeColor: strokeColors[tilesetIndex] || strokeColors[0] || null,
        opacity: Number.isFinite(opacity) ? opacity : null,
        rasterColor: rasterColors[tilesetIndex] || rasterColors[0] || null,
        hueRotate: Number.isFinite(hueRotate) ? hueRotate : null,
        saturation: Number.isFinite(saturation) ? saturation : null,
        contrast: Number.isFinite(contrast) ? contrast : null,
        brightnessMin: Number.isFinite(brightnessMin) ? brightnessMin : null,
        brightnessMax: Number.isFinite(brightnessMax) ? brightnessMax : null,
        lineWidth: Number.isFinite(lineWidth) ? lineWidth : null,
        adminLevel: Number.isFinite(adminLevel) ? adminLevel : null,
        adminCountry: adminCountries[tilesetIndex] || adminCountries[0] || null,
        adminWorldview: adminWorldviews[tilesetIndex] || adminWorldviews[0] || null,
        adminDisputed: adminDisputed[tilesetIndex] || adminDisputed[0] || null,
        filter: Array.isArray(layerFilters[tilesetIndex]) ? layerFilters[tilesetIndex] : null,
        labelText,
        labelMode,
        labelCenter,
        labelSize: Number.isFinite(labelSize) ? labelSize : null,
        labelStyle: labelStyles[tilesetIndex] || "regular",
        labelColor: labelColors[tilesetIndex] || null,
        labelHaloWidth: Number.isFinite(labelHaloWidth) ? labelHaloWidth : null,
        labelLetterSpacing: Number.isFinite(labelLetterSpacing) ? labelLetterSpacing : null,
        fixedLabels,
        labelLayerId: `${layerId}-label`,
        labelSourceId: `${layerId}-label-source`,
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

    if (config.layerType === "fill" && config.strokeColor) {
      paint["fill-outline-color"] = config.strokeColor;
    }

    if (config.layerType === "line") {
      paint["line-width"] = config.lineWidth ?? 4;
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

        if (config.filter) {
          layer.filter = config.filter;
        } else if (
          config.adminLevel !== null
          || config.adminCountry
          || config.adminWorldview
          || config.adminDisputed
        ) {
          const filter = [
            "all",
          ];

          if (config.adminLevel !== null) {
            filter.push(["==", ["to-number", ["get", "admin_level"], 0], config.adminLevel]);
          }

          if (config.adminCountry) {
            const countryCodes = config.adminCountry.split("|").filter(Boolean);

            filter.push(countryCodes.length > 1
              ? [
                  "match",
                  ["coalesce", ["get", "iso_3166_1"], ""],
                  countryCodes,
                  true,
                  false,
                ]
              : [
                  "in",
                  countryCodes[0],
                  ["coalesce", ["get", "iso_3166_1"], ""],
                ]);
          }

          if (config.adminWorldview) {
            filter.push([
              "any",
              ["==", "all", ["coalesce", ["get", "worldview"], "all"]],
              ["in", config.adminWorldview, ["coalesce", ["get", "worldview"], ""]],
            ]);
          }

          if (config.adminDisputed) {
            filter.push([
              "==",
              ["coalesce", ["get", "disputed"], "false"],
              config.adminDisputed,
            ]);
          }

          layer.filter = filter;
        }

        if (config.layerType === "line") {
          layer.layout = {
            "line-cap": "round",
            "line-join": "round",
          };
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

  function addStepLabels(map, steps) {
    steps.forEach((step, index) => {
      tilesetConfigsForStep(step, index).forEach((config) => {
        if (
          !config.labelText
          || (config.layerType === "raster" && config.labelMode !== "fixed")
          || (config.labelMode === "fixed" && !config.fixedLabels.length)
          || map.getLayer(config.labelLayerId)
        ) return;

        if (config.labelMode !== "feature" && !map.getSource(config.labelSourceId)) {
          map.addSource(config.labelSourceId, {
            type: "geojson",
            data: config.labelMode === "fixed"
              ? {
                  type: "FeatureCollection",
                  features: config.fixedLabels.map((label) => ({
                    type: "Feature",
                    properties: { label: label.text },
                    geometry: {
                      type: "Point",
                      coordinates: label.center,
                    },
                  })),
                }
              : {
                  type: "FeatureCollection",
                  features: [],
                },
          });
        }

        const labelLayer = {
          id: config.labelLayerId,
          type: "symbol",
          source: config.labelMode === "feature" ? config.sourceId : config.labelSourceId,
          layout: {
            "text-field": config.labelMode === "fixed" ? ["get", "label"] : config.labelText,
            "text-font": config.labelStyle === "italic" ? MAP_LABEL_ITALIC_FONT_STACK : MAP_LABEL_FONT_STACK,
            "text-size": config.labelSize ?? (config.labelMode === "feature" ? 15 : 18),
            "text-letter-spacing": config.labelLetterSpacing ?? 0,
            "text-anchor": config.labelMode === "feature" ? "left" : "center",
            "text-offset": config.labelMode === "feature" ? [0.8, 0] : [0, 0],
            "text-allow-overlap": config.labelMode !== "feature",
            "text-ignore-placement": config.labelMode !== "feature",
          },
          paint: {
            "text-color": config.labelColor || "#fff3bf",
            "text-halo-color": "rgba(1, 11, 9, 0.92)",
            "text-halo-width": config.labelHaloWidth ?? 1.5,
            "text-halo-blur": config.labelHaloWidth === 0 ? 0 : 0.5,
            "text-opacity": 0,
          },
        };

        if (config.labelMode === "feature") {
          labelLayer["source-layer"] = config.sourceLayer;
        }

        map.addLayer(labelLayer);

        map.setPaintProperty(config.labelLayerId, "text-opacity-transition", {
          duration: 700,
          delay: 0,
        });
      });
    });
  }

  function polygonCentroid(features) {
    let weightedLng = 0;
    let weightedLat = 0;
    let totalWeight = 0;

    function addPolygon(rings) {
      rings.forEach((ring, ringIndex) => {
        if (ring.length < 3) return;

        let crossSum = 0;
        let lngSum = 0;
        let latSum = 0;

        for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 1) {
          const current = ring[pointIndex];
          const next = ring[(pointIndex + 1) % ring.length];
          const cross = (current[0] * next[1]) - (next[0] * current[1]);
          crossSum += cross;
          lngSum += (current[0] + next[0]) * cross;
          latSum += (current[1] + next[1]) * cross;
        }

        if (Math.abs(crossSum) < Number.EPSILON) return;

        const area = Math.abs(crossSum / 2);
        const weight = ringIndex === 0 ? area : -area;
        weightedLng += (lngSum / (3 * crossSum)) * weight;
        weightedLat += (latSum / (3 * crossSum)) * weight;
        totalWeight += weight;
      });
    }

    features.forEach((feature) => {
      if (!feature.geometry) return;

      if (feature.geometry.type === "Polygon") {
        addPolygon(feature.geometry.coordinates);
      } else if (feature.geometry.type === "MultiPolygon") {
        feature.geometry.coordinates.forEach(addPolygon);
      }
    });

    if (totalWeight <= 0) return null;
    return [weightedLng / totalWeight, weightedLat / totalWeight];
  }

  function positionStepLabels(map, steps, positionedLabels) {
    steps.forEach((step, index) => {
      tilesetConfigsForStep(step, index).forEach((config) => {
        if (config.labelMode !== "centroid" || positionedLabels.has(config.labelSourceId)) return;

        const labelSource = map.getSource(config.labelSourceId);
        if (!labelSource || !map.getSource(config.sourceId)) return;

        const features = map.querySourceFeatures(config.sourceId, {
          sourceLayer: config.sourceLayer,
        });
        const center = polygonCentroid(features);
        if (!center) return;

        labelSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: center,
          },
        });
        positionedLabels.add(config.labelSourceId);
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

        if (config.labelText && map.getLayer(config.labelLayerId)) {
          map.setPaintProperty(
            config.labelLayerId,
            "text-opacity",
            step === activeStep ? 1 : 0,
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
    let mapReady = false;
    let ticking = false;
    let activeStep = null;
    const positionedLabels = new Set();

    function setActiveStep(step, options = {}) {
      if (!step) return;

      const alreadyActive = activeStep === step;
      activeStep = step;

      steps.forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === step);
      });

      if (!map || !mapReady) return;

      if (!alreadyActive || options.forceCamera) {
        const camera = cameraForStep(step);

        if (options.jump) {
          map.jumpTo(camera);
        } else {
          map.flyTo({
            ...camera,
            duration: 6400,
            curve: 1.5,
            essential: true,
          });
        }
      }

      updateStepTilesets(map, steps, step);
    }

    function updateActiveStepFromViewport(options = {}) {
      setActiveStep(stepForViewport(scrolly, steps), options);
    }

    function requestViewportUpdate() {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        updateActiveStepFromViewport();
      });
    }

    updateActiveStepFromViewport();

    if (window.mapboxgl && scrolly.dataset.mapboxToken) {
      mapboxgl.accessToken = scrolly.dataset.mapboxToken;

      map = new mapboxgl.Map({
        container: mapContainer,
        style: scrolly.dataset.mapboxStyle || "mapbox://styles/daltonwb/cmrdued7y000l01s7fnbtdf41",
        ...cameraForStep(activeStep || steps[0]),
        interactive: false,
        attributionControl: true,
      });

      map.on("load", () => {
        mapReady = true;
        mapContainer.classList.add("is-ready");
        addStepTilesets(map, steps);
        addStepPlaceholders(map, steps);
        addStepLabels(map, steps);
        updateActiveStepFromViewport({ forceCamera: true, jump: true });
      });

      map.on("idle", () => {
        positionStepLabels(map, steps, positionedLabels);
      });
    }

    window.addEventListener("scroll", requestViewportUpdate, { passive: true });
    window.addEventListener("resize", requestViewportUpdate);
  });
})();

// Rare earths video overlay
(function () {
  const hero = document.querySelector("[data-rare-earths-video-hero]");
  if (!hero) return;

  const overlay = hero.querySelector("[data-rare-earths-video-overlay]");
  const video = hero.querySelector("[data-rare-earths-header-video]");
  if (!overlay) return;

  let ticking = false;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function smoothstep(start, end, value) {
    const progress = clamp((value - start) / (end - start), 0, 1);
    return progress * progress * (3 - (2 * progress));
  }

  function updateVideo(rect) {
    if (!video) return;

    const shouldPlay = !prefersReducedMotion.matches
      && rect.bottom > 0
      && rect.top < window.innerHeight;

    if (!shouldPlay) {
      video.pause();
      return;
    }

    if (video.paused) {
      const playRequest = video.play();
      if (playRequest && typeof playRequest.catch === "function") {
        playRequest.catch(() => {});
      }
    }
  }

  function render() {
    ticking = false;

    if (prefersReducedMotion.matches) {
      overlay.style.setProperty("--rare-overlay-opacity", "1");
      overlay.style.setProperty("--rare-overlay-scale", "1");
      updateVideo(hero.getBoundingClientRect());
      return;
    }

    const rect = hero.getBoundingClientRect();
    const scrollableHeight = Math.max(hero.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / scrollableHeight, 0, 1);
    const scaleProgress = smoothstep(0.06, 0.88, progress);
    const opacityProgress = smoothstep(0.04, 0.38, progress);

    overlay.style.setProperty("--rare-overlay-opacity", opacityProgress.toFixed(3));
    overlay.style.setProperty("--rare-overlay-scale", (0.38 + (0.62 * scaleProgress)).toFixed(3));
    updateVideo(rect);
  }

  function requestRender() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(render);
  }

  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", requestRender);
  }

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", requestRender);
  requestRender();
})();

// Index hero / scroll mosaic
(function () {
  const hero = document.querySelector("[data-index-hero]");
  if (!hero) return;

  const mosaic = hero.querySelector("[data-index-hero-mosaic]");
  const leadTile = hero.querySelector("[data-index-hero-lead]");
  const videos = Array.from(hero.querySelectorAll("[data-index-hero-video]"));
  const tiles = Array.from(hero.querySelectorAll("[data-index-hero-tile]"));
  const revealTiles = tiles.filter((tile) => tile !== leadTile);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const entranceOffsets = [
    { x: 42, y: -26 },
    { x: 34, y: 40 },
    { x: -44, y: 34 },
    { x: -28, y: 52 },
    { x: 46, y: 30 },
    { x: -38, y: -32 },
    { x: 30, y: 48 },
    { x: -34, y: 38 },
    { x: 40, y: -28 },
    { x: -26, y: 44 },
  ];

  let ticking = false;
  let mosaicRect = null;
  let initialLeadRect = null;
  let finalLeadRect = null;
  let mosaicTravel = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  function smoothstep(start, end, progress) {
    const value = clamp((progress - start) / (end - start), 0, 1);
    return value * value * (3 - 2 * value);
  }

  function heroProgress(rect) {
    const scrollableHeight = Math.max(hero.offsetHeight - window.innerHeight, 1);
    return clamp(-rect.top / scrollableHeight, 0, 1);
  }

  function pauseVideos() {
    videos.forEach((video) => video.pause());
  }

  function playVideos() {
    if (prefersReducedMotion.matches) return;

    videos.filter((video) => video.paused).forEach((video) => {
      const playRequest = video.play();

      if (playRequest && typeof playRequest.catch === "function") {
        playRequest.catch(() => {});
      }
    });
  }

  function updateVideoPlayback(rect, mediaIsVisible = true) {
    if (!videos.length) return;

    if (prefersReducedMotion.matches) {
      videos.forEach((video) => video.removeAttribute("autoplay"));
      pauseVideos();
      return;
    }

    videos.forEach((video) => video.setAttribute("autoplay", ""));

    const isNearHero = mediaIsVisible
      && rect.bottom > -window.innerHeight * 0.4
      && rect.top < window.innerHeight * 1.4;

    if (!isNearHero) {
      pauseVideos();
      return;
    }

    playVideos();
  }

  function setTileRect(tile, rect) {
    tile.style.left = `${rect.left}px`;
    tile.style.top = `${rect.top}px`;
    tile.style.width = `${rect.width}px`;
    tile.style.height = `${rect.height}px`;
  }

  function clearMeasuredStyles() {
    if (mosaic) {
      mosaic.style.removeProperty("--index-mosaic-shift");
    }

    tiles.forEach((tile) => {
      tile.style.removeProperty("transform");
    });

    if (!leadTile) return;
    leadTile.style.removeProperty("left");
    leadTile.style.removeProperty("top");
    leadTile.style.removeProperty("width");
    leadTile.style.removeProperty("height");
  }

  function measureGeometry() {
    if (!mosaic || !leadTile) return;

    clearMeasuredStyles();

    mosaicRect = mosaic.getBoundingClientRect();
    const leadRect = leadTile.getBoundingClientRect();

    initialLeadRect = {
      left: -mosaicRect.left,
      top: -mosaicRect.top,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    finalLeadRect = {
      left: leadRect.left - mosaicRect.left,
      top: leadRect.top - mosaicRect.top,
      width: leadRect.width,
      height: leadRect.height,
    };

    const contentBottom = Math.max(...tiles.map((tile) => (
      tile.getBoundingClientRect().bottom - mosaicRect.top
    )));
    mosaicTravel = Math.max(contentBottom - window.innerHeight + (window.innerHeight * 0.08), 0);
  }

  function render() {
    ticking = false;

    if (prefersReducedMotion.matches) {
      clearMeasuredStyles();
      updateVideoPlayback(hero.getBoundingClientRect());
      return;
    }

    if (!initialLeadRect || !finalLeadRect || !mosaicRect) {
      measureGeometry();
    }

    const heroRect = hero.getBoundingClientRect();
    const progress = heroProgress(heroRect);
    const leadProgress = smoothstep(0.1, 0.42, progress);
    const trackProgress = smoothstep(0.3, 0.98, progress);
    const mosaicShift = -mosaicTravel * trackProgress;

    mosaic.style.setProperty("--index-mosaic-shift", `${mosaicShift}px`);

    const leadRect = {
      left: lerp(initialLeadRect.left, finalLeadRect.left, leadProgress),
      top: lerp(initialLeadRect.top, finalLeadRect.top, leadProgress),
      width: lerp(initialLeadRect.width, finalLeadRect.width, leadProgress),
      height: lerp(initialLeadRect.height, finalLeadRect.height, leadProgress),
    };
    if (leadTile) {
      setTileRect(leadTile, leadRect);
      leadTile.style.opacity = "1";
    }

    revealTiles.forEach((tile, index) => {
      const start = 0.18 + index * 0.065;
      const tileProgress = smoothstep(start, Math.min(start + 0.18, 0.92), progress);
      const offset = entranceOffsets[index] || { x: 36, y: 36 };
      const scale = lerp(0.94, 1, tileProgress);

      tile.style.opacity = `${tileProgress}`;
      tile.style.transform = `translate(${lerp(offset.x, 0, tileProgress)}px, ${lerp(offset.y, 0, tileProgress)}px) scale(${scale})`;
    });

    const mediaIsVisible = videos.some((video) => {
      const videoRect = video.getBoundingClientRect();
      return videoRect.bottom > 0 && videoRect.top < window.innerHeight;
    });

    updateVideoPlayback(heroRect, mediaIsVisible);
  }

  function requestRender() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(render);
  }

  function handleResize() {
    measureGeometry();
    requestRender();
  }

  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", handleResize);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(handleResize).catch(() => {});
  }

  measureGeometry();
  render();

  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", handleResize);
})();
