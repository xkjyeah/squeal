import {Expression, Value, Column} from './Expression';
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
  public joins : [[string, string], [string, string]] | void;

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

  static fromTable(tableName: string, sourceName?: string) {
    const instance = new RowSource();
    sourceName = sourceName || tableName;
    instance.sources = <SourceList>{};
    instance.sources[sourceName] = [new Table(tableName), ''];
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

  public select(colSelections : ColSelectionParam[]) : void {
    const selected : ColSelection[] =
      colSelections.map((colSelection) : ColSelection => {
        if (typeof colSelection === 'string' ||
          colSelection instanceof Array) {
            let column = this.col(<string | [string,string]>colSelection);
            return column;
        } else {
          let column = this.col((<AliasedColSelection>colSelection).selection);
          return [column, colSelection.as];
        }
      });
    this.selected = selected;
  }

  public toSQL() : string {
    // Quickly allocate some table name
    // FIXME: don't allow the names to clash
    _.each(this.sources, (table_alias, source) => {
      table_alias[1] = source;
    });

    const selectClause = 'SELECT ' +
      (this.selected ?
        (<ColSelection[]>this.selected).map((colSelection) => {
          let column = (colSelection instanceof Column) ?
            colSelection : colSelection[0];

          let as = (colSelection instanceof Column) ?
            '' : ` AS "${colSelection[1]}"`

          return column.toSQL() + as;
        }).join(',')
        : '*')

    // FIXME: deal with inner joins
    const fromClause = 'FROM ' +
      _.keys(this.sources)
        .map(sourceName => {
          const table_alias = this.sources[sourceName];
          return `"${table_alias[0].name}" AS "${table_alias[1]}"`
        })
        .join('')

    return [
      selectClause,
      fromClause
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
    if (second) {
      assert.strictEqual(_.keys(this.rowSource.sources).length, 1);
      return new Column(this.rowSource, _.keys(this.rowSource.sources)[0], second);
    }
    else {
      return new Column(this.rowSource, first, second);
    }
  }
}

class Table {
  public name : string;
  constructor (name: string) { this.name = name }
}

enum OrderDirection {
  ASC = 0,
  DESC = 1
};
type WhereClause = (row : Row) => Expression;
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
  [string, string] |
  AliasedColSelection /* source name and column name */

type ColSelection = Column | [Column, string];

interface AliasedColSelection {
  selection: string | [string, string];
  as: string;
}
