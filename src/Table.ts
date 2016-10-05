import {Query, JoinCondition} from './Query';
import {Row} from './Row';
import {RowSource} from './RowSource';
import {Expression} from './Expression';
import * as assert from 'assert';
import * as _ from 'lodash';

export class Table extends RowSource {
  public primaryKey: string;

  constructor (name : string, primaryKey: string = 'id') {
    super(name);
    this.primaryKey = primaryKey;
  }
}
