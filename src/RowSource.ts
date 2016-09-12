import {Expression, Value, literal} from './Expression';
import {Column} from './Column';
import {Table} from './Model';
import {Row} from './Row';
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

  /* Selects only the columns specified in exprs */
  public select(exprs : SelectArg[]) : RowSource {
    return this._select([], exprs);
  }

  /*
    Selects previously selected columns ('*' if none previously selected),
    plus some additional columns specified in expr
  */
  public andSelect(exprs : SelectArg[]) : RowSource {
    return this._select(
      <ColSelection[]>this.selected || [() => literal('*')],
      exprs
    )
  }

  private _select(previous : ColSelection[], exprs : SelectArg[]) : RowSource {
    const instance = new RowSource(this);

    function fail() : Expression {
      throw new Error("Unknown type case");
    }

    function resolveColumnExpression(expr: SelectColumnExpression) : ExpressionFn {
      if (typeof expr === 'string') {
        return (row: Row) => row.col(<string>expr);
      }
      else if (expr instanceof Array) {
        return (row: Row) => row.col(
          (<[string, string]>expr)[0],
          (<[string, string]>expr)[1]
        );
      }
      else if (expr instanceof Function) {
        return <(row:Row) => Expression> expr;
      }
      else {
        fail();
      }
    }

    const selected : ColSelection[] =
      exprs.map((expr) : ColSelection => {
        /* string */
        if (typeof expr === 'string' ||
            typeof expr === 'function' ||
            expr instanceof Array) {
              return resolveColumnExpression(<string>expr)
        }
        else {
          return <[ExpressionFn, string]>[
            resolveColumnExpression(<string>(<AliasedSelectColumnExpression>expr).expr),
            (<AliasedSelectColumnExpression>expr).as
          ];
        }
      });

    instance.selected = previous.concat(selected);
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

    const whereConditions = (where_WhereConditions.concat(joins_WhereConditions));
    const whereClause = whereConditions.length > 0 ?
      'WHERE ' + whereConditions.join(' AND\n    ')
      : '';

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

enum OrderDirection {
  ASC = 0,
  DESC = 1
};
export type WhereClause = (row : Row) => Expression;
export type JoinCondition = (row: Row, master: string, thatRowSource: string) => Expression;
export type JoinClause = [string, string, JoinCondition];
export type OrderByClause = [
  (row : Row) => Expression,
  OrderDirection
]


export type ExpressionFn = (row: Row) => Expression;
/**
  1) column reference only
  2) column reference and alias
  */
export type SelectColumnExpression =
  string | /* column name only */
  [string, string] | /* source name and column name */
  ExpressionFn; /* an arbitrary expression */

export type SelectArg =
  SelectColumnExpression |
  AliasedSelectColumnExpression;

export type ColSelection =
  ExpressionFn |
  [ExpressionFn, string];

export interface AliasedSelectColumnExpression {
  expr: SelectColumnExpression;
  as: string;
}
