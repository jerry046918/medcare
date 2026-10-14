require('dotenv').config();
const { server: serverConfig, checkRequiredEnvVars } = require('./config');
const { sequelize } = require('./models');
const { createApp } = require('./app');

checkRequiredEnvVars();
const app = createApp();

(async () => {
  try {
    await sequelize.sync({ force: false });
    app.listen(serverConfig.port, () => {
      console.log(`服务器运行在端口 ${serverConfig.port}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
})();
