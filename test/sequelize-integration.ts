declare var process : any;
declare var require : (string) => any;
// import * as Sequelize from 'sequelize';

const Sequelize = require('sequelize');

export {Sequelize};
export var db = new Sequelize(
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGPASSWORD,
{
  host: process.env.PGHOST,
  dialect: 'postgres',
})
