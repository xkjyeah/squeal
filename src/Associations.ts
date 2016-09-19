import {RowSource} from './RowSource';
import {Row} from './Row';
import {JoinCondition} from './Query';

export class Association {
  public isSingle : boolean;

  constructor(isSingle: boolean) {
    this.isSingle = isSingle;
  }
}

export class HasManyAssociation extends Association {
  public master: RowSource;
  public slave: RowSource;
  public joinConditions: JoinCondition[];

  constructor(master: RowSource, slave: RowSource, options: AssociationOptions = {}) {
    super(false);
    this.master = master;
    this.slave = slave;

    let foreignKey = options.foreignKey || master.name + 'Id';
    let targetKey : string;

    targetKey = options.targetKey || <string>this.master.primaryKey;
    if (!targetKey) throw new Error(`Target key must be defined!`);

    this.joinConditions = [
      (row: Row, masterSource: string, slaveSource: string) =>
        row.col(masterSource, targetKey) .eq
        (row.col(slaveSource, foreignKey))
    ]
  }
}

export class BelongsToAssociation extends HasManyAssociation {
  public master: RowSource;
  public slave: RowSource;
  public joinConditions: JoinCondition[];

  constructor(master: RowSource, slave: RowSource, foreignKey?: string) {
    // Cheat...
    super(slave, master, foreignKey);
    this.isSingle = true;
  }
}

export interface AssociationOptions {
  foreignKey?: string,
  targetKey?: string,
  as?: string
}
