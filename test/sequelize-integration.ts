import * as Sequelize from 'sequelize';

export {Sequelize};
export var db = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
{
  host: process.env.PGHOST,
  dialect: 'postgres',
})
