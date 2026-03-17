module.exports = {
  apps: [
    {
      name: "shoumya-portfolio",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/shoumya-portfolio",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
