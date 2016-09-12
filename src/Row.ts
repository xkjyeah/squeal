import {Expression, Value} from './Expression';
import {Column} from './Column';
import {Table} from './Model';
import {RowSource, JoinClause} from './RowSource';
import * as _ from 'lodash';
import * as assert from 'assert';

export class Row {
  public rowSource : RowSource;

  constructor (rowSource: RowSource) {
    this.rowSource = rowSource;
  }

  col(sourceName: string, columnName: string) : Column;
  col(columnName: string) : Column;
  col(first: string, second?: any) : Column {
    if (!second) {
      assert.strictEqual(_.keys(this.rowSource.sources).length, 1);
      return new Column(this.rowSource, _.keys(this.rowSource.sources)[0], first);
    }
    else {
      return new Column(this.rowSource, first, second);
    }
  }

  fetch(thisSource: string, otherSource : Table, as? : string) : Row;
  fetch(otherSource : Table, as? : string) : Row;
  fetch(first: any, second?: any, third?: any) : Row {
    let thisSource: string, otherSource: Table, as: string;

    if (first instanceof Table) {
      assert.strictEqual(_.keys(this.rowSource.sources).length, 1);
      thisSource = _.keys(this.rowSource.sources)[0];
      ([otherSource, as] = [first, second])
    }
    else if (typeof first === 'string') {
      ([thisSource, otherSource, as] = [first, second, third]);
    }
    else {
      assert(false);
    }

    as = as || otherSource.name;

    // get the association
    let association = this.rowSource.sources[thisSource][0].associations[as];

    let rowSource = RowSource.fromTable(otherSource, as);
    rowSource.context = this.rowSource;
    rowSource.joins = rowSource.joins || [];
    rowSource.joins = (<JoinClause[]>rowSource.joins).concat(
      association.joinConditions.map(joinCondition =>
        [thisSource, as, joinCondition])
    )

    return new Row(rowSource);
  }
}
