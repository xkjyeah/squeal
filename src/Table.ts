import {Query, JoinCondition} from './Query';
import {Row} from './Row';
import {RowSource} from './RowSource';
import {Expression} from './Expression';

export class Table extends RowSource {
  public primaryKey: string;

  constructor (name : string, primaryKey: string = 'id') {
    super(name);
    this.primaryKey = primaryKey;
  }
}
