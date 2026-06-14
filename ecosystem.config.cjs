/**
 * COLYSEUS CLOUD WARNING:
 * ----------------------
 * PLEASE DO NOT UPDATE THIS FILE MANUALLY AS IT MAY CAUSE DEPLOYMENT ISSUES
 */

module.exports = {
  apps : [{
    name: "colyseus-app",
    script: 'build/index.js',
    time: true,
    watch: false,
    // Colyseus local presence/driver keeps seat reservations inside one process.
    // Use Redis presence/driver and sticky routing before increasing this value.
    instances: 1,
    exec_mode: 'fork',
    wait_ready: false,
    env_production: {
      NODE_ENV: 'production',
      COLYSEUS_SEAT_RESERVATION_TIME: process.env.COLYSEUS_SEAT_RESERVATION_TIME || '60'
    }
  }],
};
