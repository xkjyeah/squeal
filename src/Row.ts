import {Expression, Value} from './Expression';
import {Column} from './Column';
import {Table} from './Table';
import {Query, JoinClause} from './Query';
import * as _ from 'lodash';
import * as assert from 'assert';

export class Row {
  public query : Query;

  constructor (query: Query) {
    this.query = query;
  }

  col(sourceName: string, columnName: string) : Column;
  col(columnName: string) : Column;
  col(first: string, second?: any) : Column {
    if (!second) {
      assert.strictEqual(_.keys(this.query.sources).length, 1);
      return new Column(this.query, _.keys(this.query.sources)[0], first);
    }
    else {
      return new Column(this.query, first, second);
    }
  }

  fetch(thisSource: string, otherSource : Table, as? : string) : Row;
  fetch(otherSource : Table, as? : string) : Row;
  fetch(first: any, second?: any, third?: any) : Row {
    let thisSource: string, otherSource: Table, as: string;

    if (first instanceof Table) {
      assert.strictEqual(_.keys(this.query.sources).length, 1);
      thisSource = _.keys(this.query.sources)[0];
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
    let association = this.query.sources[thisSource][0].associations[as];

    let query = Query.fromTable(otherSource, as);
    query.context = this.query;
    query.joins = query.joins || [];
    query.joins = (<JoinClause[]>query.joins).concat(
      association.joinConditions.map(joinCondition =>
        [thisSource, as, joinCondition])
    )

    return new Row(query);
  }
}
