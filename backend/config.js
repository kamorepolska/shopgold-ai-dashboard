require('dotenv').config();

module.exports = {
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
  },
  shopgold: {
    connectionType: process.env.SHOPGOLD_CONNECTION_TYPE || 'xml',
    xmlFeedUrl: process.env.SHOPGOLD_XML_FEED_URL || '',
    adminUrl: process.env.SHOPGOLD_ADMIN_URL || '',
    adminUser: process.env.SHOPGOLD_ADMIN_USER || '',
    adminPass: process.env.SHOPGOLD_ADMIN_PASS || '',
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASS || '',
    database: process.env.MYSQL_DATABASE || '',
    tablePrefix: process.env.MYSQL_TABLE_PREFIX || 'sg_',
  },
};
