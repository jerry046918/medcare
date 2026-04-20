const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');
const { db: dbConfig } = require('../config');

async function migrate() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbConfig.storage,
    logging: false
  });

  const queryInterface = sequelize.getQueryInterface();

  const uploadDir = path.join(__dirname, '../uploads/reports');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('[Migration] Created directory:', uploadDir);
  }

  const tableDesc = await queryInterface.describeTable('medical_reports');

  // Use raw SQL for RENAME COLUMN to avoid Sequelize's buggy table-rebuild approach
  if ('pdfPath' in tableDesc && !('filePath' in tableDesc)) {
    await sequelize.query(
      'ALTER TABLE `medical_reports` RENAME COLUMN `pdfPath` TO `filePath`'
    );
    console.log('[Migration] Renamed pdfPath → filePath');
  }

  if (!('fileName' in tableDesc)) {
    await queryInterface.addColumn('medical_reports', 'fileName', {
      type: DataTypes.STRING,
      allowNull: true
    });
    console.log('[Migration] Added fileName column');
  }

  console.log('[Migration] Done');
  await sequelize.close();
}

migrate().catch(err => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});
