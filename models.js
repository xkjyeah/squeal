const Seq = require('sequelize');
const db = new Sequelize('postgres://postgres:12345678@localhost/postgres')

export var models = {
  JournalEntry: db.define('journalEntry', {
    description: Seq.TEXT,
  }),

  LineItem: db.define('lineItem', {
    journalEntryId: {
      type: Seq.INTEGER,
      allowNull: false,
    },
    foreignItemType: {
      type: Seq.TEXT,
      allowNull: false,
    },
    foreignItemId: {
      type: Seq.INTEGER,
      allowNull: false,
    },
    debit: {
      type: Seq.INTEGER,
      allowNull: false,
    },
    credit: {
      type: Seq.VIRTUAL,
      get() {
        return -this.getDataValue(credit);
      },
      set(value) {
        return this.setDataValue(-value);
      }
    }
  }),

  Asset: db.define('cash', {
    name: {
      type: Seq.TEXT,
      primaryKey: true,
    }
  }, {
    classMethods: { get: getByName }
  }),

  Liability: db.define('cash', {
    name: {
      type: Seq.TEXT,
      primaryKey: true,
    }
  }, {
    classMethods: { get: getByName }
  }),

  Expense: db.define('cash', {
    name: {
      type: Seq.TEXT,
      primaryKey: true,
    }
  }, {
    classMethods: { get: getByName }
  }),

  Revenue: db.define('cash', {
    name: {
      type: Seq.TEXT,
      primaryKey: true,
    }
  }, {
    classMethods: { get: getByName }
  }),
}

function getByName(name) {
  return this.findOrCreate({
    where: {name: name},
    defaults: {name: name}
  })
}
