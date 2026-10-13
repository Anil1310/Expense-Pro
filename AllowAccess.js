/**
 * =========================================================================
 * EXPENSE TRACKER PRO - MULTI-YEAR ACCESS & AUTHORIZATION SERVICE
 * =========================================================================
 * Owner Email: anil.chahar170@gmail.com
 * Trackers: 2021 - 2026
 */

const OWNER_EMAIL = "anil.chahar170@gmail.com";

const TRACKER_CONFIGS = [
  {
    name: "Expenses Tracker 2021",
    year: 2021,
    sheetId: "1gZGndcf0cG1gvNhw5x2kFPGS2xKvk8XPzj8M55q_e3o",
    tabName: "Data"
  },
  {
    name: "Expenses Tracker 2022",
    year: 2022,
    sheetId: "1bXsqDFvtLpsFDDhJe5fq5y_9qcGN-JoM0OsdFReUnEA",
    tabName: "Data"
  },
  {
    name: "Expenses Tracker 2023",
    year: 2023,
    sheetId: "1vIgYRlZK1rwO04toj_AkgvE4lfDJnfSJhY9K7tEqqCw",
    tabName: "Data"
  },
  {
    name: "Expenses Tracker 2024",
    year: 2024,
    sheetId: "1HOgsxjaByM-IAMwF_9sCMjp8_1AbXkbH3u1iyTJyAXY",
    tabName: "Data"
  },
  {
    name: "Expenses Tracker 2025",
    year: 2025,
    sheetId: "1FINFdoloFAYseb-3vHkVokHm1J37eBFGW0z5GkECzgo",
    tabName: "Data"
  },
  {
    name: "Expenses Tracker 2026",
    year: 2026,
    sheetId: "1WK0QOkrz4c7Fl-wvkLKrH1gPODxkF3stvYajR5lVM0M",
    tabName: "Data"
  }
];

/**
 * 1. Grant editor and drive access to anil.chahar170@gmail.com
 * 2. Test opening each spreadsheet and verifying the 'Data' tab.
 */
function grantAndAuthorizeAllTrackers() {
  Logger.log("=================================================================");
  Logger.log(`🚀 STARTING ACCESS & AUTHORIZATION FOR ${OWNER_EMAIL}`);
  Logger.log("=================================================================");

  let successCount = 0;
  let failedCount = 0;
  const results = [];

  TRACKER_CONFIGS.forEach((tracker, idx) => {
    try {
      // 1. Grant/Verify Drive Permission
      try {
        const file = DriveApp.getFileById(tracker.sheetId);
        file.addEditor(OWNER_EMAIL);
      } catch (driveErr) {
        Logger.log(`ℹ️ Drive notice for ${tracker.name}: ${driveErr.message}`);
      }

      // 2. Open spreadsheet and verify tab
      const ss = SpreadsheetApp.openById(tracker.sheetId);
      const sheet = ss.getSheetByName(tracker.tabName);

      if (!sheet) {
        throw new Error(`Tab '${tracker.tabName}' not found in sheet '${ss.getName()}'`);
      }

      const rowCount = sheet.getLastRow();
      const colCount = sheet.getLastColumn();

      Logger.log(`✅ [${idx + 1}/${TRACKER_CONFIGS.length}] CONNECTED: ${tracker.name}`);
      Logger.log(`   - Name: "${ss.getName()}"`);
      Logger.log(`   - Tab: "${tracker.tabName}" (Rows: ${rowCount}, Cols: ${colCount})`);

      results.push({
        tracker: tracker.name,
        year: tracker.year,
        sheetId: tracker.sheetId,
        status: "CONNECTED",
        rows: rowCount
      });
      successCount++;
    } catch (err) {
      Logger.log(`❌ [${idx + 1}/${TRACKER_CONFIGS.length}] FAILED: ${tracker.name} (${tracker.sheetId})`);
      Logger.log(`   Error: ${err.message}`);
      results.push({
        tracker: tracker.name,
        year: tracker.year,
        sheetId: tracker.sheetId,
        status: "FAILED",
        error: err.message
      });
      failedCount++;
    }
  });

  Logger.log("=================================================================");
  Logger.log(`📊 SUMMARY: ${successCount} Successful, ${failedCount} Failed`);
  Logger.log("=================================================================");

  return results;
}

/**
 * Creates or updates the '_AllowAccess' sheet in the currently active spreadsheet.
 * Sets single IMPORTRANGE formulas so you can click "Allow Access" for each sheet.
 */
function setupAllowAccessHelperSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let authSheet = ss.getSheetByName("_AllowAccess");

  if (!authSheet) {
    authSheet = ss.insertSheet("_AllowAccess");
  } else {
    authSheet.clear();
  }

  // Header row
  authSheet.getRange("A1:C1").setValues([["Tracker Name", "Sheet ID", "IMPORTRANGE Authorization (Click Allow Access if #REF!)"]]);
  authSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
  authSheet.setColumnWidth(1, 220);
  authSheet.setColumnWidth(2, 380);
  authSheet.setColumnWidth(3, 350);

  TRACKER_CONFIGS.forEach((item, index) => {
    const row = index + 2;
    authSheet.getRange(row, 1).setValue(item.name);
    authSheet.getRange(row, 2).setValue(item.sheetId);
    authSheet.getRange(row, 3).setFormula(`=IMPORTRANGE("${item.sheetId}", "${item.tabName}!A1")`);
  });

  SpreadsheetApp.flush();
  Logger.log("✅ '_AllowAccess' helper sheet created successfully.");
}

/**
 * Pulls and consolidates all data across 2021-2026 trackers directly in Apps Script
 * (Bypasses IMPORTRANGE limits and formula errors).
 */
function getConsolidatedAllYearsData() {
  const consolidatedRows = [];
  let serialNumber = 1;

  TRACKER_CONFIGS.forEach(tracker => {
    try {
      const ss = SpreadsheetApp.openById(tracker.sheetId);
      const sheet = ss.getSheetByName(tracker.tabName);
      if (!sheet || sheet.getLastRow() <= 1) return;

      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      const rows = values.slice(1);

      // Find column indices
      const findIdx = (names) => {
        for (let name of names) {
          const idx = headers.findIndex(h => h && h.toString().toLowerCase().includes(name.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxDate = findIdx(['date']);
      const idxAmount = findIdx(['amount', 'price', 'cost']);
      const idxItem = findIdx(['item', 'category', 'description']);

      rows.forEach(row => {
        const rawDate = idxDate !== -1 ? row[idxDate] : '';
        const rawAmount = idxAmount !== -1 ? row[idxAmount] : 0;
        const rawItem = idxItem !== -1 ? row[idxItem] : '';

        if (!rawDate && !rawAmount) return;

        consolidatedRows.push({
          sn: serialNumber++,
          date: rawDate,
          item: rawItem,
          amount: parseFloat(rawAmount) || 0,
          trackerName: tracker.name,
          year: tracker.year
        });
      });
    } catch (err) {
      Logger.log(`Warning fetching ${tracker.name}: ${err.message}`);
    }
  });

  return consolidatedRows;
}
