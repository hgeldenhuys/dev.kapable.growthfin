module.exports = {
  apps: [{
    name: "signaldb-api",
    script: "src/index.ts",
    interpreter: "/home/deploy/.bun/bin/bun",
    cwd: "/opt/signaldb/apps/api",
    env: {
      DATABASE_URL: "postgresql://signaldb:signaldb_prod_secure_2024@localhost:5440/signaldb",
      PORT: 3003,
      NODE_ENV: "production",
      ENCRYPTION_KEY: "v1V3yGeCsabyUvFlJyvhOdtzqm0aZrlmaBOVAthIoY",
      DEPLOY_SECRET: "04dd50ad15e282b8b0bb79616d11941c33bd25495e2233942747bc6ea624288a",
      ALERT_EMAIL: "herman@agileworks.co.za",
      RESEND_API_KEY: "re_AzEMwD9F_5quUqqbRVWPnfrypyuaiiTxG",
      EMAIL_FROM: "noreply@signaldb.live"
    }
  }]
};
