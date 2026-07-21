const catalyst = require('zcatalyst-sdk-node');
const fs = require('fs');
const path = require('path');

// Map markdown schema types to Catalyst Data Store types
const TYPE_MAPPING = {
  'Int': 'bigint',
  'Text': 'varchar',
  'Date': 'datetime',
  'Datetime': 'datetime',
  'Double': 'double',
  'Boolean': 'boolean'
};

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

module.exports = async (cronDetails, context) => {
  try {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();
    
    // In the Catalyst cloud environment, we must use the file bundled inside the function directory
    const schemaPath = path.join(__dirname, 'catalyst-schema.md');

    console.log(`Parsing schema from ${schemaPath}...\n`);
    const tables = parseSchema(schemaPath);
    console.log(`Found ${tables.length} tables in schema.\n`);

    for (const tableDef of tables) {
      const { tableName, columns } = tableDef;
      
      console.log(`Creating table '${tableName}' with ${columns.length} columns...\n`);
      
      const columnsToCreate = columns.map(col => {
        const c = { ...col };
        if (c.data_type !== 'varchar') delete c.max_length;
        return c;
      });

      try {
        const createdTable = await datastore.createTable({
          table_name: tableName,
          columns: columnsToCreate
        });
        console.log(`Successfully created table '${tableName}' (ID: ${createdTable.table_id})\n`);
      } catch (err) {
        if (err.toString().includes('ALREADY_EXISTS') || (err.message && err.message.includes('exists'))) {
          console.log(`Table '${tableName}' already exists. Skipping.\n`);
        } else {
          console.log(`Failed to create table '${tableName}': ${err.toString()}\n`);
          // Continue with next table
        }
      }
    }

    context.closeWithSuccess('Table creation complete.');
  } catch (error) {
    context.closeWithFailure(`Initialization error: ${error.toString()}`);
  }
};
