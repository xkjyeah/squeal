import * as _ from 'lodash';
import {Table} from './Table';

export class ModelManager {
  public tables : Table[];
  public tablesByName : {[tableName: string]: Table};

  /** Import a sequelize db schema **/
  constructor(sequelize) {
    this.tables = sequelize.modelManager.all.map(s => {
      const table = new Table(s.tableName, s.primaryKeyAttribute)
      table.db = sequelize;
      return table;
    })

    this.tablesByName = _.keyBy(this.tables, 'name')

    for (let seqModel of sequelize.modelManager) {
      _.forEach(seqModel.associations, (association : any, assocName : string) => {
        let table = this.tablesByName[association.source.tableName];
        let otherTable = this.tablesByName[association.target.tableName];

        // FIXME: use targetKey from sequelize
        console.log('ASSOC TYPE', association.associationType);
        if (association.associationType === 'HasMany') {
          table.hasMany(otherTable, assocName);
        }
        else if (association.associationType === 'BelongsTo') {
          table.belongsTo(otherTable, assocName);
        }
        else {
          throw new Error("Unimplemented");
        }
      })
    }
  }
}
