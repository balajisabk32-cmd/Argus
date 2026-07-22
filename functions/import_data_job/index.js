const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const catalyst = require('zcatalyst-sdk-node');

/**
 * Reads a CSV file and returns all rows as an array of objects.
 */
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Basic cleanup of empty keys if any
        const cleanData = {};
        for (const key in data) {
          cleanData[key.trim()] = data[key];
        }
        rows.push(cleanData);
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// Hardcoded schema matching the CSV files
const TABLES = [
  "CaseMaster", "Unit", "District", "GravityOffence", "CrimeHead", 
  "Accused", "Victim", "Employee", "PersonMaster", "ArrestSurrender", 
  "Anomalies", "Hotspots", "TrendAlerts", "StationRiskScore", 
  "ComplainantDetails", "OccupationMaster"
];

module.exports = async (cronDetails, context) => {
  try {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();
    const datasetsDir = path.join(__dirname, 'Datasets');

    console.log(`Starting bulk import of datasets...`);

    for (const tableName of TABLES) {
      const csvPath = path.join(datasetsDir, `${tableName}.csv`);
      
      if (!fs.existsSync(csvPath)) {
        console.warn(`[SKIP] CSV not found for table ${tableName} at ${csvPath}`);
        continue;
      }

      console.log(`\n--- Processing Table: ${tableName} ---`);
      
      try {
        console.log(`Reading data from ${tableName}.csv...`);
        const rows = await readCSV(csvPath);
        console.log(`Found ${rows.length} rows to import.`);

        if (rows.length === 0) continue;

        const tableRef = datastore.table(tableName);
        const batchSize = 100;
        let inserted = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await tableRef.insertRows(batch);
          inserted += batch.length;
          console.log(`Inserted ${inserted} / ${rows.length} rows into ${tableName}...`);
        }

        console.log(`Finished importing ${tableName}.`);
      } catch (error) {
        console.error(`Failed to process table ${tableName}:`, error.message || error.toString());
      }
    }

    console.log('\nAll datasets have been processed!');
    context.closeWithSuccess('Data import complete.');
  } catch (error) {
    console.error('Initialization error:', error.toString());
    context.closeWithFailure(`Initialization error: ${error.toString()}`);
  }
};
