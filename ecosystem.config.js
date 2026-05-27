module.exports = {
  apps: [
    {
      name: 'rice-app',
      script: 'app.js',
      cwd: __dirname,
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'localtunnel',
      script: 'node',
      args: 'node_modules/localtunnel/bin/lt --port 3002',
      cwd: __dirname,
      interpreter: 'node',
      watch: false
    }
    ,
    {
      name: 'notifications-cleanup-scheduler',
      script: 'scripts/scheduler/notifications-cleanup-scheduler.js',
      cwd: __dirname,
      interpreter: 'C:\\Program Files\\nodejs\\node.exe',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
