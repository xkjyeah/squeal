import {Expression, Value} from './Expression';
import {Column} from './Column';
import {AllColumns} from './AllColumns';
import {Table} from './Table';
import {Query, JoinClause, SourceReferenceSubstitutions} from './Query';
import * as _ from 'lodash';
import * as assert from 'assert';

export class Row {
  public query : Query;
  public substitutions : SourceReferenceSubstitutions[];
  public defaultSourceName : string;

  constructor (query: Query) {
    this.query = query;
    this.substitutions = [];
    this.defaultSourceName = query._defaultSource;
  }

  clone() : Row {
    let clone = new Row(this.query);
    clone.substitutions = _.clone(this.substitutions);
    clone.defaultSourceName = _.clone(this.defaultSourceName);
    return clone;
  }

  applySubstitutions(subs: SourceReferenceSubstitutions) : Row {
    let clone = this.clone();

    clone.substitutions = clone.substitutions.concat([subs])

    return clone;
  }

  /**
    Successively apply substitutions
  */
  substitute(source: string) : string {
    let result = _.reduce(this.substitutions, (acc, val, key, col) => {
      if (acc in val) {
        return val[acc];
      } else {
        return acc;
      }
    }, source)

    console.log('substitute()', source, result, this.substitutions)
    return result;
  }

  star(sourceName: string) : AllColumns {
    return new AllColumns(this.query, sourceName);
  }

  col(sourceName: string, columnName: string) : Column;
  col(columnName: string) : Column;
  col(first: string, second?: any) : Column {
    if (!second) {
      return new Column(this.query, this.substitute(this.defaultSourceName), first);
    }
    else {
      return new Column(this.query, this.substitute(first), second);
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

    let query = Query.fromRowSource(otherSource, as);
    query.context = this.query;
    query.joins = query.joins || [];
    query.joins = (<JoinClause[]>query.joins).concat(
      association.joinConditions.map(joinCondition =>
        [thisSource, as, joinCondition])
    )

    return new Row(query);
  }
}
