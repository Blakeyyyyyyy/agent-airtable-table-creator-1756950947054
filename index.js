const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_PAT;
const BASE_URL = 'https://api.airtable.com/v0';

let logs = [];

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}: ${message}`;
  logs.push(logEntry);
  console.log(logEntry);
  // Keep only last 100 logs
  if (logs.length > 100) logs = logs.slice(-100);
}

// Get Airtable headers
function getHeaders() {
  return {
    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

// Status endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    service: 'Airtable Table Creator',
    endpoints: [
      'GET / - Service status',
      'GET /health - Health check',
      'GET /logs - View recent logs',
      'GET /bases - List all bases',
      'GET /bases/:baseId/tables - List tables in a base',
      'POST /bases/:baseId/tables - Create new table',
      'POST /test - Test the service'
    ],
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  const isHealthy = !!AIRTABLE_TOKEN;
  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    hasToken: !!AIRTABLE_TOKEN,
    timestamp: new Date().toISOString()
  });
});

// View logs
app.get('/logs', (req, res) => {
  res.json({
    logs: logs.slice(-50),
    total: logs.length
  });
});

// List all bases
app.get('/bases', async (req, res) => {
  try {
    log('Fetching all bases');
    
    const response = await axios.get(`${BASE_URL}/meta/bases`, {
      headers: getHeaders()
    });
    
    const bases = response.data.bases.map(base => ({
      id: base.id,
      name: base.name,
      permissionLevel: base.permissionLevel
    }));
    
    log(`Found ${bases.length} bases`);
    res.json({ bases });
    
  } catch (error) {
    log(`Error fetching bases: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch bases',
      details: error.response?.data || error.message 
    });
  }
});

// List tables in a base
app.get('/bases/:baseId/tables', async (req, res) => {
  try {
    const { baseId } = req.params;
    log(`Fetching tables for base ${baseId}`);
    
    const response = await axios.get(`${BASE_URL}/meta/bases/${baseId}/tables`, {
      headers: getHeaders()
    });
    
    const tables = response.data.tables.map(table => ({
      id: table.id,
      name: table.name,
      primaryFieldId: table.primaryFieldId,
      fieldCount: table.fields ? table.fields.length : 0
    }));
    
    log(`Found ${tables.length} tables in base ${baseId}`);
    res.json({ tables });
    
  } catch (error) {
    log(`Error fetching tables: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch tables',
      details: error.response?.data || error.message 
    });
  }
});

// Create new table
app.post('/bases/:baseId/tables', async (req, res) => {
  try {
    const { baseId } = req.params;
    const { name, fields = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Table name is required' });
    }
    
    log(`Creating table "${name}" in base ${baseId}`);
    
    // Default fields if none provided
    const tableFields = fields.length > 0 ? fields : [
      {
        name: 'Name',
        type: 'singleLineText'
      },
      {
        name: 'Notes',
        type: 'multilineText'
      },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Active', color: 'greenBright' },
            { name: 'Inactive', color: 'redBright' },
            { name: 'Pending', color: 'yellowBright' }
          ]
        }
      },
      {
        name: 'Created',
        type: 'createdTime'
      }
    ];
    
    const tableData = {
      name,
      fields: tableFields
    };
    
    const response = await axios.post(
      `${BASE_URL}/meta/bases/${baseId}/tables`,
      tableData,
      { headers: getHeaders() }
    );
    
    log(`Successfully created table "${name}" with ID: ${response.data.id}`);
    
    res.json({
      success: true,
      table: {
        id: response.data.id,
        name: response.data.name,
        fields: response.data.fields
      }
    });
    
  } catch (error) {
    log(`Error creating table: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to create table',
      details: error.response?.data || error.message 
    });
  }
});

// Test endpoint
app.post('/test', async (req, res) => {
  try {
    log('Testing Airtable connection');
    
    const response = await axios.get(`${BASE_URL}/meta/bases`, {
      headers: getHeaders()
    });
    
    log(`Test successful - found ${response.data.bases.length} bases`);
    
    res.json({
      success: true,
      message: 'Airtable connection working',
      basesFound: response.data.bases.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log(`Test failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`Airtable Table Creator started on port ${PORT}`);
});