// Compatibility entrypoint. Production starts src/manager.js so Discord
// sharding and global command registration happen exactly once.
require('./manager');
