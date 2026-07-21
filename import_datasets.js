const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const catalyst = require('zcatalyst-sdk-node');

// Map markdown schema types to Catalyst Data Store types
const TYPE_MAPPING = {
  'Int': 'bigint',
  'Text': 'varchar',
  'Date': 'datetime',
  'Datetime': 'datetime',
  'Double': 'double',
  'Boolean': 'boolean'
};

/**
 * Parses the catalyst-schema.md file to extract table definitions.
 */
function parseSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const lines = content.split('\n');
  
  const tables = [];
  let currentTable = null;

  for (const line of lines) {
    const tableMatch = line.match(/^##\s+([A-Za-z0-9_]+)/);
    if (tableMatch) {
      currentTable = {
        tableName: tableMatch[1],
        columns: []
      };
      tables.push(currentTable);
      continue;
    }

    if (currentTable && line.startsWith('|') && !line.includes('---|---') && !line.includes('Column | Type')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length === 2) {
        const colName = parts[0];
        const colType = parts[1];
        
        currentTable.columns.push({
          column_name: colName,
          data_type: TYPE_MAPPING[colType] || 'varchar',
          max_length: TYPE_MAPPING[colType] === 'varchar' ? 255 : null,
          is_mandatory: false
        });
      }
    }
  }
  
  return tables;
}

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

/**
 * Main function to create tables and import datasets.
 * @param {object} context - The Catalyst context (if running in a function) or null (if running locally with credentials)
 */
async function importDatasets(context = null) {
  // Initialize Catalyst app
  const app = context ? catalyst.initialize(context) : catalyst.initialize();
  const datastore = app.datastore();

  const schemaPath = path.join(__dirname, 'catalyst-schema.md');
  const datasetsDir = path.join(__dirname, 'Datasets');

  console.log('Parsing schema from catalyst-schema.md...');
  const tables = parseSchema(schemaPath);
  console.log(`Found ${tables.length} tables in schema.`);

  for (const tableDef of tables) {
    const { tableName, columns } = tableDef;
    const csvPath = path.join(datasetsDir, `${tableName}.csv`);
    
    if (!fs.existsSync(csvPath)) {
      console.warn(`[SKIP] CSV not found for table ${tableName} at ${csvPath}`);
      continue;
    }

    console.log(`\n--- Processing Table: ${tableName} ---`);
    try {
      // 1. Create the Table
      console.log(`Creating table '${tableName}' with ${columns.length} columns...`);
      // We drop the max_length for non-varchar columns to avoid SDK errors
      const columnsToCreate = columns.map(col => {
        const c = { ...col };
        if (c.data_type !== 'varchar') delete c.max_length;
        return c;
      });

      let createdTable;
      try {
        createdTable = await datastore.createTable({
          table_name: tableName,
          columns: columnsToCreate
        });
        console.log(`Successfully created table '${tableName}' (ID: ${createdTable.table_id})`);
      } catch (err) {
        if (err.toString().includes('ALREADY_EXISTS') || err.message.includes('exists')) {
          console.log(`Table '${tableName}' already exists. Proceeding with import...`);
        } else {
          throw err;
        }
      }

      // 2. Read the CSV data
      console.log(`Reading data from ${tableName}.csv...`);
      const rows = await readCSV(csvPath);
      console.log(`Found ${rows.length} rows to import.`);

      if (rows.length === 0) continue;

      // 3. Batch insert the rows
      const tableRef = datastore.table(tableName);
      const batchSize = 100;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await tableRef.insertRows(batch);
        inserted += batch.length;
        console.log(`Inserted ${inserted} / ${rows.length} rows...`);
      }

      console.log(`Finished importing ${tableName}.`);
    } catch (error) {
      console.error(`Failed to process table ${tableName}:`, error.message);
    }
  }

  console.log('\nAll datasets have been processed!');
}

// If run directly via node, execute the function
if (require.main === module) {
  // Note: To run this locally, you must have Catalyst initialized properly,
  // typically by passing { type: 'basic', project_id: '...', project_key: '...' }
  // to catalyst.initialize() or running it in a Catalyst execution environment.
  importDatasets().catch(err => {
    console.error('Import process failed:', err);
    process.exit(1);
  });
}

module.exports = { importDatasets };
