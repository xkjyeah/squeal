import {Expression, Value, literal} from './Expression';
import {Column} from './Column';
import {RowSource} from './RowSource';
import {Row} from './Row';
import {HasManyAssociation, BelongsToAssociation} from './Associations';
import * as Util from './Util';
import * as _ from 'lodash';
import * as assert from 'assert';

type SourceList = {string : [RowSource, string]};

export interface Context {
  sources: SourceList;
  resolveSource: (s: string) => string;
}

export class Query {
  public context : Query | void;

  // Mapping of some label -> Table + SQL alias
  public sources : SourceList;
  public whereClauses : WhereClause[] | void;
  public orderByClauses : OrderByClause[] | void;
  public limit : number | void;
  public joins : JoinClause[] | void;

  // Retrieval settings
  public includes : Query[] | void;

  public selected : ColSelection[] | void;

  constructor(that?: Query) {
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

  static fromRowSource(rowSource: RowSource, _sourceName?: string) {
    const instance = new Query();
    let sourceName = _sourceName || rowSource.name;
    instance.sources = <SourceList>{};
    instance.sources[sourceName] = [rowSource, ''];
    return instance;
  }

  public resolveSource(sourceName : string) : string {
    let source_as = this._resolveSourceQuiet(sourceName);

    if (!source_as) throw new Error(`Unresolved source ${sourceName}`);

    return source_as[1];
  }
  private _resolveSourceQuiet(sourceName : string) : [RowSource, string] | void {
    if (sourceName in this.sources) {
      return this.sources[sourceName];
    }

    if (!this.context) {
      return null;
    }
    return (<Query>this.context)._resolveSourceQuiet(sourceName);
  }

  /* Selects only the columns specified in exprs */
  public select(exprs : SelectArg[]) : Query {
    return this._select([], exprs);
  }

  /*
    Selects previously selected columns ('*' if none previously selected),
    plus some additional columns specified in expr
  */
  public andSelect(exprs : SelectArg[]) : Query {
    return this._select(
      <ColSelection[]>this.selected || [() => literal('*')],
      exprs
    )
  }

  private _select(previous : ColSelection[], exprs : SelectArg[]) : Query {
    const instance = new Query(this);

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

  private _generateSourceName(preferred : string = '') : string {
    let candidate = preferred || Util.autogenerateName();
    let index = 1;

    while (this._resolveSourceQuiet(candidate)) {
      candidate = preferred + index;
      index += 1;
    }
    return candidate;
  }

  public where(whereClause: WhereClause) {
    const instance = new Query(this);
    instance.whereClauses = instance.whereClauses || [];
    instance.whereClauses = (<WhereClause[]>instance.whereClauses).concat([whereClause]);
    return instance;
  }

  public join(joinReference : JoinReference, options : JoinOptions | void = null) {
    let joinSource : Query;
    let joinAsOpt: string | void = options && options.as;
    let joinAliasOpt : string | void = options && (options.alias || options.as);
    let joinAs : string;
    let joinAlias : string;
    let joinConditions = options && options.on;
    let joinClauses : JoinClause[] = [];
    let clone = new Query(this);

    if (joinReference instanceof RowSource) {
      joinSource = Query.fromRowSource(<RowSource>joinReference);
      joinAlias = joinAliasOpt || this._generateSourceName(joinReference.name);
      joinAs = joinAsOpt || this._generateSourceName(joinReference.name);

      if (joinConditions) {
        joinClauses = <JoinClause[]>joinConditions.map(jc => {
          if (jc instanceof Array) {
            return [jc[0], joinAlias, jc[1]];
          }
          else if (typeof jc === 'function') {
            assert.equal(_.size(this.sources), 1, "Multiple sources in Query ==> please state the source when joining");
            return [Object.keys(this.sources)[0], joinAlias, jc];
          }
          else {
            assert(false);
          }
        });
      }
    }
    else if (typeof joinReference === 'string') {
      //
      let match = _(this.sources)
        .toPairs()
        .flatten()
        .map(x => [x[1], x[0][0]]) // pick the table
        .map(([selfSource, table]) => _.toPairs(table.associations).map(([x,y]) => [selfSource, x, y])) // get the related tables
        .flatten()
        .find(([selfSource, assocName, association]) => assocName === <string>joinReference);

      // If there isn't already a ON clause in the join options,
      // import them from the association
      let [selfSource, assocName, association] = <any>match;
      if (association instanceof HasManyAssociation) {
        joinConditions = joinConditions ? joinConditions.concat(association.joinConditions) : association.joinConditions;
        joinSource = Query.fromRowSource(<RowSource>association.slave);
        joinAlias = joinAliasOpt || this._generateSourceName(assocName);
        joinAs = joinAsOpt || assocName;
      }
      else if (association instanceof BelongsToAssociation) {
        joinConditions = joinConditions ? joinConditions.concat(association.joinConditions) : association.joinConditions;
        joinSource = Query.fromRowSource(<RowSource>association.slave);
        joinAlias = joinAliasOpt || this._generateSourceName(assocName);
        joinAs = joinAsOpt || assocName || association.name;
      }
      else {
        throw new Error(`Unimplemented join for association ${association}`)
      }

      joinClauses = joinConditions.map(jc => {
        if (typeof jc === 'function') {
          return <JoinClause>[selfSource, joinAlias, jc];
        } else if (jc instanceof Array && jc.length === 2) {
          return <JoinClause>[selfSource, jc[0], jc[1]];
        } else {
          assert(false);
        }
      })
    }
    else if (joinReference instanceof Query) {
      joinSource = joinReference;
      joinAlias = joinAliasOpt || this._generateSourceName();
      joinAs = <string>joinAsOpt;

      joinClauses = <JoinClause[]>joinConditions.map(jc => {
        if (jc instanceof Array) {
          return [jc[0], joinAlias, jc[1]];
        }
        else if (typeof jc === 'function') {
          assert.equal(_.size(this.sources), 1, "Multiple sources in Query ==> please state the source when joining");
          return [Object.keys(this.sources)[0], joinAlias, jc];
        }
        else {
          assert(false);
        }
      });
    }
    else {
      assert(false, `Unknown JoinReference type ${joinReference}`)
    }

    assert(joinAs, `No valid AS alias could be inferred for ${joinReference}`)

    clone.sources[joinAlias] = [joinSource, joinAs];
    if (joinClauses) {
      clone.joins = clone.joins ? clone.joins.concat(joinClauses) : joinClauses;
    }
    return clone;
  }

  public include(otherQuery: Query) {
    let clone = new Query(this);

    clone.includes = clone.includes || [];
    (<Query[]>clone.includes).push(otherQuery);

    return clone;
  }

  public async get(db) {
    let selfSQL = this.toSQL();

    let rows = await db.query(selfSQL, {
      type: db.QueryTypes.SELECT
    });

    //
    let primaryKeyValues = rows.map(r => r[primaryKeyAttribute]);
    for (let include of this.includes) {
      // See how this model is linked to the other model
      //
      include.where((row) => row[foreignKeyAttribute].in(list(primaryKeyValues)))
        .get()
        .then((subModelRows) => {
          // When results are returned, assign them
          let groups = _.groupBy(subModelRows);

          for (let row of rows) {
            row[subModelAs] = groups;
          }
        });
    }

    return rows;
  }
}

enum OrderDirection {
  ASC = 0,
  DESC = 1
};
export type WhereClause = (row : Row) => Expression;
export type JoinCondition = (row: Row, master: string, thatQuery: string) => Expression;
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

export type JoinReference =
  string |
  RowSource |
  Query;

export interface JoinOptions {
  alias?: string,
  as?: string,
  on?: (JoinCondition | [string, JoinCondition])[],
}

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
