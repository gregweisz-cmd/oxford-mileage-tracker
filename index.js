// Redirect to backend server
const path = require('path');
const serverPath = path.join(__dirname, 'admin-web', 'backend', 'server.js');
require(serverPath);
