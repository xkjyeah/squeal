/// <reference path="./must.d.ts" />

declare var require : any;
declare var __filename : string;

import * as Lab from 'lab';
import * as expect from 'must';

import {Table, Query} from '../src/index.ts';
import {db, Sequelize} from './sequelize-integration.ts';
import {ModelManager} from '../src/SequelizeIntegration.ts';

const lab = exports.lab = Lab.script();

lab.experiment('Basic Query with Database', () => {
  var Person;
  var Pet;
  var PetQ : Query;
  var PersonQ : Query;
  var modelManager : ModelManager;

  lab.before(async function() {
    Person = db.define('person', {
      name: Sequelize.STRING,
      dateOfBirth: Sequelize.DATE,
    }, {
      tableName: 'persons'
    })

    PersonQ = Query.fromTable('persons', {
      columnNames: ['name', 'dateOfBirth', 'id', 'createdAt', 'updatedAt']
    })

    Pet = db.define('pet', {
      name: Sequelize.STRING,
      breed: Sequelize.STRING,
      ownerId: Sequelize.INTEGER
    })

    PetQ = Query.fromTable('pets', {
      columnNames: ['id', 'name', 'breed', 'ownerId', 'createdAt', 'updatedAt']
    })

    Person.hasMany(Pet, {
      foreignKey: 'ownerId'
    })
    Pet.belongsTo(Person, {
      foreignKey: 'ownerId'
    })

    await db.sync();
//
    var michael = await Person.create({
      name: 'Michael',
      date: '2000-01-05'
    })
    await michael.addPet(await Pet.create({
      name: 'Bubbles',
      breed: 'Chihuahua'
    }))

    var john = await Person.create({
      name: 'John',
      date: '1990-12-30'
    })
    await john.addPet(await Pet.create({
      name: 'Dolly',
      breed: 'Miniature Poodle'
    }))
    await john.addPet(await Pet.create({
      name: 'Ruff',
      breed: 'Dobermann'
    }))

    modelManager = new ModelManager(db);
  });

  lab.after(async function() {
    await Person.drop();
    await Pet.drop();
  })

  lab.test('Table select', async function () {
    var persons = await PersonQ.get(db)

    expect(persons.find(p => p.name === 'Michael')).exist()
    expect(persons.find(p => p.name === 'John')).exist()
  });

  lab.test('Table select with where', async function () {
    var persons = await PersonQ
      .where((row) => row.col('name').eq('Michael'))
      .get(db)

    expect(persons.find(p => p.name === 'Michael')).exist()
    expect(persons.find(p => p.name !== 'Michael')).not.exist()
  });

  // lab.test('Table select with join (where outside)', async function() {
  //   var persons = await PersonQ
  //     .where((row) => row.col('name').eq('Michael'))
  //     .include('pets', {}).get(db)
  //
  //   expect(persons.length).equal(1)
  //   expect(persons[0].name).equal('Michael')
  //   expect(persons[0].pets.length).equal(1)
  //   expect(persons[0].pets[0].name).equal('Bubbles')
  // })
  //
  // lab.test('Table select with join (where inside)', async function() {
  //   var personQuery = Query.fromRowSource(modelManager.tablesByName['people']);
  //   var petQuery = Query.fromRowSource(modelManager.tablesByName['pets']);
  //   var persons = await personQuery
  //                   .include(petQuery.where(row => row.col('name').eq('Ruff'))).get(db)
  //
  //   expect(persons.length).equal(2)
  //   expect(persons.find(p => p.name === 'Michael').pets.length).equal(0)
  //   expect(persons.find(p => p.name === 'John').pets.length).equal(1)
  //   expect(persons.find(p => p.name === 'John').pets[0].name).equal('Ruff')
  // })
  //
  // lab.test('Where on related table, but no join', async function() {
  //   var personQuery = Query.fromRowSource(modelManager.tablesByName['people']);
  //   var persons = await personQuery.where(
  //     row => row.fetch(modelManager.tablesByName['pets'])
  //       .where(pet => pet.name.eq('Dolly')).exists()
  //   ).get(db)
  //
  //   expect(persons.length).equal(1)
  //   expect(persons[0].name).equal('John')
  //   expect(persons[0].pets).not.exists()
  // })
});
