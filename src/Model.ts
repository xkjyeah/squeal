import {Row, RowSource, JoinCondition} from './RowSource';
import {Expression} from './Expression';

export class Table {
  public name : string;
  public associations : { [otherName: string]: Association };
  public primaryKey: string;

  constructor (name: string, primaryKey: string = 'id') {
    this.name = name;
    this.associations = {};
    this.primaryKey = primaryKey;
  }

  hasMany(that: Table, as?: string) {
    as = as || that.name;
    this.associations[as] = new HasManyAssociation(this, that);
  }

  belongsTo(that: Table, as?: string) {
    as = as || that.name;
    this.associations[as] = new BelongsToAssociation(that, this);
  }
}

export class Association {
  public isSingle : boolean;

  constructor(isSingle: boolean) {
    this.isSingle = isSingle;
  }
}

export class HasManyAssociation extends Association {
  public master: Table;
  public slave: Table;
  public joinConditions: JoinCondition[];

  constructor(master: Table, slave: Table, foreignKey?: string) {
    super(false);
    this.master = master;
    this.slave = slave;

    foreignKey = foreignKey || master.name + 'Id';

    this.joinConditions = [
      (row: Row, masterSource: string, slaveSource: string) =>
        row.col(masterSource, this.master.primaryKey) .eq
        (row.col(slaveSource, foreignKey))
    ]
  }
}

export class BelongsToAssociation extends HasManyAssociation {
  public master: Table;
  public slave: Table;
  public joinConditions: JoinCondition[];

  constructor(master: Table, slave: Table, foreignKey?: string) {
    // Cheat...
    super(slave, master, foreignKey);
    this.isSingle = true;
  }
}
