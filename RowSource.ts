import {Expression, Value, Column} from './Expression';
import {Table} from './Model';
import * as _ from 'lodash';
import * as assert from 'assert';

type SourceList = {string : [Table, string]};
export interface Context {
  sources: SourceList;
  resolveSource: (s: string) => string;
}

export class RowSource {
  public context : RowSource | void;

  // Mapping of some label -> Table + SQL alias
  public sources : SourceList;
  public whereClauses : WhereClause[] | void;
  public orderByClauses : OrderByClause[] | void;
  public limit : number | void;
  public joins : JoinClause[] | void;

  public selected : ColSelection[] | void;

  constructor(that?: RowSource) {
    if (that) {
      this.context = that.context;
      this.sources = that.sources;
      this.whereClauses = that.whereClauses;
      this.orderByClauses = that.orderByClauses;
      this.limit = that.limit;
      this.joins = that.joins;
      this.selected = that.selected;
    }
  }

  static fromTable(table: Table, sourceName?: string) {
    const instance = new RowSource();
    sourceName = sourceName || table.name;
    instance.sources = <SourceList>{};
    instance.sources[sourceName] = [table, ''];
    return instance;
  }

  public resolveSource(sourceName : string) : string {
    if (sourceName in this.sources) {
      return this.sources[sourceName][1];
    }

    if (!this.context) {
      throw new Error(`Source "${sourceName}" not found`)
    }
    return (<RowSource>this.context).resolveSource(sourceName);
  }

  public select(colSelections : ColSelectionParam[]) : RowSource {
    const instance = new RowSource(this);

    function fail() : Expression {
      throw new Error("Unknown type case");
    }

    const selected : ColSelection[] =
      colSelections.map((colSelection) : ColSelection => {
        /* string */
        return (typeof colSelection == 'string') ? this.col(<string>colSelection)
        /* [Expression, string] , [string, string] */
          : (colSelection instanceof Array) ? (
                /* [string, string] */
                (typeof colSelection[0] == 'string') ? this.col(<[string,string]>colSelection)
                /* [Expression, string] */
                : (colSelection[0] instanceof Expression) ? <[Expression, string]>colSelection
                : fail())
          : (colSelection instanceof Expression) ? colSelection
          : [ this.col(<string | [string, string]>(<AliasedColSelection>colSelection).selection),
              (<AliasedColSelection>colSelection).as
            ];
      });
    instance.selected = selected;
    return instance;
  }

  public toSQL() : string {
    // Quickly allocate some table name
    // FIXME: don't allow the names to clash
    _.each(this.sources, (table_alias, source) => {
      table_alias[1] = source;
    });

    const selectClause = 'SELECT \n    ' +
      (this.selected ?
        (<ColSelection[]>this.selected).map((colSelection) => {
          let column = (colSelection instanceof Expression) ?
            colSelection : colSelection[0];

          let as = (colSelection instanceof Expression) ?
            '' : ` AS "${colSelection[1]}"`

          return column.toSQL() + as;
        }).join(',\n    ')
        : '*')

    // FIXME: deal with inner joins
    const fromClause = 'FROM ' +
      _.keys(this.sources)
        .map(sourceName => {
          const table_alias = this.sources[sourceName];
          return `"${table_alias[0].name}" AS "${table_alias[1]}"`
        })
        .join('')

    const row = new Row(this);

    const where_WhereConditions =
      (<any>_(this.whereClauses))
        .map(fn => fn(row).toSQL())
        .value()

    const joins_WhereConditions =
      (<any>_(this.joins || []))
        .map(([thisSource, thatSource, joinExpr]) => {
          // console.log(this);
          // console.log(thisSource);
          // console.log(thatSource);
          // console.log(joinExpr);
          return joinExpr(row, thisSource, thatSource).toSQL();
        })
        .value();

    const whereClause = 'WHERE ' +
      (where_WhereConditions.concat(joins_WhereConditions))
      .join(' AND\n    ');

    return [
      selectClause,
      fromClause,
      whereClause
    ].join('\n')
  }

  public col(colSelection : string | [string,string]) : Column {
    if (typeof colSelection === 'string') {
      assert.strictEqual(_.keys(this.sources).length, 1);
      return new Column(this,
          _.keys(this.sources)[0],
          colSelection);
    }
    else {
      return new Column(this, colSelection[0], colSelection[1]);
    }
  }

  public where(whereClause: WhereClause) {
    const instance = new RowSource(this);
    instance.whereClauses = instance.whereClauses || [];
    instance.whereClauses = (<WhereClause[]>instance.whereClauses).concat([whereClause]);
    return instance;
  }
}

export class Row {
  public rowSource : RowSource;

  constructor (rowSource: RowSource) {
    this.rowSource = rowSource;
  }

  col(first: string, second: string) : Column;
  col(first: string) : Column;
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

enum OrderDirection {
  ASC = 0,
  DESC = 1
};
type WhereClause = (row : Row) => Expression;
export type JoinCondition = (row: Row, master: string, thatRowSource: string) => Expression;
type JoinClause = [string, string, JoinCondition];
type OrderByClause = [
  (row : Row) => Expression,
  OrderDirection
]
/**
  1) column reference only
  2) column reference and alias
  */
type ColSelectionParam =
  string | /* column name only */
  Expression |
  [Expression, string] |
  [string, string] | /* source name and column name */
  AliasedColSelection

type ColSelection = Expression | [Expression, string];

interface AliasedColSelection {
  selection: string | [string, string];
  as: string;
}
