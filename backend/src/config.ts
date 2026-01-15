import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  port: number;
  botToken: string;
  masterKey: string;
  databasePath: string;
  frontendPath: string;
  nodeEnv: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  botToken: getEnvVar('BOT_TOKEN'),
  masterKey: getEnvVar('MASTER_KEY'),
  databasePath: getEnvVar('DATABASE_PATH', path.join(__dirname, '../data/ssh-miniapp.db')),
  frontendPath: getEnvVar('FRONTEND_PATH', path.join(__dirname, '../public')),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
