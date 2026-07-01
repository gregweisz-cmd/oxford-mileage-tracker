const googleMapsService = require('../services/googleMapsService');
const { debugLog, debugWarn, debugError } = require('../debug');

/**
 * Render Google Maps pages for one cost center (deferred to end of PDF).
 */
async function renderCostCenterMaps(doc, ctx, options) {
  const {
    margin,
    pageWidth,
    safeText,
    mapViewMode,
    isFinanceUser,
    isCostCenterMapsEnabled,
    getBaseAddressLabel,
    abbreviateForDisplay,
    isExplicitlyBaseAddress,
    normalizeMileageEntryForPdfMaps,
    formatMapDateForPdf
  } = options;

  const { costCenter, entriesForCostCenter, baseAddress, baseAddress2 } = ctx;
  const mileageEntries = entriesForCostCenter || [];

  const drawMapRowCentered = (yPosRef, text) => {
    const mapRowMaxWidth = pageWidth - margin * 2;
    const mapLineHeight = 12;
    const lines = doc.splitTextToSize(text, mapRowMaxWidth);
    lines.forEach((line) => {
      safeText(line, pageWidth / 2, yPosRef.value, { align: 'center' });
      yPosRef.value += mapLineHeight;
    });
  };

  try {
    const userIsFinance = isFinanceUser();
    const mapsEnabled = await isCostCenterMapsEnabled(costCenter);
    const apiConfigured = googleMapsService.isConfigured();
    const effectiveMapViewMode = mapViewMode || (userIsFinance && mapsEnabled ? 'day' : null);

    if (!userIsFinance || !mapsEnabled || !apiConfigured || !effectiveMapViewMode) {
      return;
    }

    debugLog(`🗺️ Deferred maps for ${costCenter}, mode: ${effectiveMapViewMode}`);

    let biasLatLng = null;
    if (baseAddress) {
      biasLatLng = await googleMapsService.geocodeToLatLng(baseAddress);
    }

    const renderTripMapPage = async (meta, entry, singleRoute) => {
      const yPosRef = { value: margin + 16 };
      try {
        const mapResult = await googleMapsService.downloadStaticMapImageFromRoutes(singleRoute, { size: '600x400', biasLatLng });
        const mapImage = Buffer.isBuffer(mapResult) ? mapResult : mapResult.imageBuffer;
        const tripSummary = Buffer.isBuffer(mapResult) ? null : mapResult.tripSummary;
        const imageDataUrl = googleMapsService.imageBufferToDataUrl(mapImage);
        doc.addPage();
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        meta.headerLines.forEach((line) => drawMapRowCentered(yPosRef, line));
        yPosRef.value += 6;
        const imageWidth = pageWidth - margin * 2;
        const imageHeight = (imageWidth * 400) / 600;
        doc.addImage(imageDataUrl, 'PNG', margin, yPosRef.value, imageWidth, imageHeight);
        yPosRef.value += imageHeight + 12;
        if (tripSummary && (tripSummary.distanceText || tripSummary.durationText)) {
          doc.setFontSize(9);
          const tripLine = [tripSummary.distanceText, tripSummary.durationText].filter(Boolean).join(' · ');
          if (tripLine) {
            safeText(tripLine, pageWidth / 2, yPosRef.value, { align: 'center' });
          }
        }
      } catch (mapError) {
        debugError(`❌ Error generating map for ${costCenter}:`, mapError);
        doc.addPage();
        yPosRef.value = margin + 16;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        meta.headerLines.forEach((line) => drawMapRowCentered(yPosRef, line));
        yPosRef.value += 6;
        const placeholderH = 120;
        const placeholderW = pageWidth - margin * 2;
        const placeholderX = margin;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(placeholderX, yPosRef.value, placeholderW, placeholderH);
        yPosRef.value += placeholderH / 2 - 8;
        doc.setFontSize(11);
        safeText('Map could not be generated for this trip.', pageWidth / 2, yPosRef.value, { align: 'center' });
        yPosRef.value += 14;
        safeText('Please add the route map manually.', pageWidth / 2, yPosRef.value, { align: 'center' });
      }
    };

    const tripLocationLabels = (entry) => {
      const tripStartAddr = entry.startLocationAddress || '';
      const tripEndAddr = entry.endLocationAddress || '';
      const startLabel = getBaseAddressLabel(tripStartAddr, baseAddress, baseAddress2) || abbreviateForDisplay(tripStartAddr);
      const endLabel = getBaseAddressLabel(tripEndAddr, baseAddress, baseAddress2) || abbreviateForDisplay(tripEndAddr);
      const nameFromLoc = (loc) => (loc && typeof loc === 'string' && loc.includes('(')) ? loc.replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
      const startName = entry.startLocationName || nameFromLoc(entry.startLocation) || '';
      const endName = entry.endLocationName || nameFromLoc(entry.endLocation) || '';
      const withName = (name, addr) => (!name || !String(name).trim()) ? (addr || '—') : (addr ? `${String(name).trim()} (${addr})` : String(name).trim());
      const startBA = getBaseAddressLabel(tripStartAddr, baseAddress, baseAddress2);
      const endBA = getBaseAddressLabel(tripEndAddr, baseAddress, baseAddress2);
      const isStartBase = startBA || isExplicitlyBaseAddress(entry, 'start', baseAddress, baseAddress2);
      const isEndBase = endBA || isExplicitlyBaseAddress(entry, 'end', baseAddress, baseAddress2);
      const baseAddrForDisplay = (ba) => abbreviateForDisplay(ba === 'BA2' ? (baseAddress2 || '') : (baseAddress || ''));
      const startDisplay = isStartBase ? `BA (${baseAddrForDisplay(startBA || 'BA')})` : withName(startName, startLabel);
      const endDisplay = isEndBase ? `BA (${baseAddrForDisplay(endBA || 'BA')})` : withName(endName, endLabel);
      return { startDisplay, endDisplay };
    };

    if (effectiveMapViewMode === 'costCenter') {
      const sortedCcEntries = [...mileageEntries]
        .map((e) => normalizeMileageEntryForPdfMaps(e, baseAddress, baseAddress2))
        .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

      for (let tripIndex = 0; tripIndex < sortedCcEntries.length; tripIndex++) {
        const entry = sortedCcEntries[tripIndex];
        const tripRoutes = googleMapsService.collectRoutesForDay([entry]);
        if (tripRoutes.length === 0) continue;
        const { startDisplay, endDisplay } = tripLocationLabels(entry);
        const tripNum = tripIndex + 1;
        await renderTripMapPage({
          headerLines: [
            `Cost Center Routes - ${costCenter} (Trip ${tripNum} of ${sortedCcEntries.length})`,
            `Date: ${formatMapDateForPdf(entry.date) || '—'}`,
            `Cost Center: ${costCenter || '—'}`,
            `Starting Location: ${startDisplay || '—'}`,
            `Ending Location: ${endDisplay || '—'}`,
            `Miles Driven (Tracked by GPS): ${entry.miles != null && entry.miles !== '' ? String(entry.miles) : '—'}`
          ]
        }, entry, [tripRoutes[0]]);
      }
      return;
    }

    if (effectiveMapViewMode === 'day') {
      const entriesByDate = {};
      mileageEntries.forEach((entry) => {
        const dateKey = entry.date.split('T')[0] || entry.date.split(' ')[0];
        if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
        entriesByDate[dateKey].push(entry);
      });

      const sortedDates = Object.keys(entriesByDate).sort();
      for (const date of sortedDates) {
        const dayEntries = (entriesByDate[date] || []).map((entry) =>
          normalizeMileageEntryForPdfMaps(entry, baseAddress, baseAddress2)
        );
        const dayRoutes = googleMapsService.collectRoutesForDay(dayEntries);
        if (dayRoutes.length === 0) {
          debugWarn(`Maps skipped: No map points for date ${date} (cost center: ${costCenter})`);
        }
        for (let tripIndex = 0; tripIndex < dayRoutes.length; tripIndex++) {
          const entry = dayEntries[tripIndex];
          if (!entry) continue;
          const { startDisplay, endDisplay } = tripLocationLabels(entry);
          await renderTripMapPage({
            headerLines: [
              `Date: ${formatMapDateForPdf(entry.date) || '—'}`,
              `Cost Center: ${costCenter || '—'}`,
              `Starting Location: ${startDisplay || '—'}`,
              `Ending Location: ${endDisplay || '—'}`,
              `Miles Driven (Tracked by GPS): ${entry.miles != null && entry.miles !== '' ? String(entry.miles) : '—'}`
            ]
          }, entry, [dayRoutes[tripIndex]]);
        }
      }
    }
  } catch (error) {
    debugError('❌ Error in deferred map generation:', error);
  }
}

async function renderAllCostCenterMaps(doc, contexts, options) {
  if (!contexts || contexts.length === 0) return;
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  options.safeText('ROUTE MAPS', options.pageWidth / 2, options.margin + 20, { align: 'center' });
  for (const ctx of contexts) {
    await renderCostCenterMaps(doc, ctx, options);
  }
}

module.exports = {
  renderCostCenterMaps,
  renderAllCostCenterMaps
};
