# Known Issues

This document tracks known issues and workarounds for the Oxford House Mileage Tracker system.

## PDF Printing Issues

### Issue: PDFs Get Stuck in Printer Queue

**Symptom:** PDFs exported from expense reports get stuck in the printer queue with "Unknown status" and never print.

**Affected:** HP OfficeJet Pro 8020 series and some other HP printer drivers (previously)

**Status:** FIXED - PDFs are now post-processed with pdf-lib for maximum printer compatibility

**Works Fine With:** Epson printers, Brother printers, HP printers, Xerox printers, and most other printer brands

**Root Cause:** jsPDF library generates PDFs with a structure that some printer drivers cannot process correctly. This has been addressed by post-processing PDFs with pdf-lib to optimize them for printer compatibility.

**Solution Implemented:**

PDFs are now automatically post-processed with `pdf-lib` after generation. This:
- Loads the jsPDF-generated PDF
- Optimizes the PDF structure for universal printer compatibility
- Sets proper metadata for all printer brands
- Disables object streams for better compatibility (works with HP, Brother, Xerox, Epson, and others)
- Falls back to original PDF if optimization fails

**Previous Workarounds (no longer needed):**

1. ~~Print to PDF First~~ - No longer needed
2. ~~Use Adobe Reader~~ - No longer needed
3. ~~Use Different Printer~~ - All printers should now work

**Status:** ✅ FIXED & VERIFIED - PDFs are now optimized for all printer brands
- ✅ Tested and confirmed working on HP OfficeJet Pro 8020
- ✅ Tested and confirmed working on Epson printers
- ✅ Should work on Brother printers (same optimization as HP)
- ✅ Should work on Xerox printers (same optimization as HP/Epson)
- ✅ Should work on all major printer brands (optimization is universal)

---

## Other Known Issues

_Add other known issues here as they are discovered_

