import {Expression, Value, literal} from './Expression';
import {Column} from './Column';
import {RowSource} from './RowSource';
import {Row} from './Row';
import {HasManyAssociation, BelongsToAssociation} from './Associations';
import * as Util from './Util';
import * as _ from 'lodash';
import * as assert from 'assert';

type SourceList = {string : [RowSource, string]};

export class Query {
  public dataSources: {[source: string] : (Query | string)}
  public _substitutions: SourceReferenceSubstitutions[]
  public _whereClauses: WhereClause[]
  public _orderByClause: OrderByClause
  public _selectExpressions: SelectExpression[]
  public _name : string;
  public _primaryKey: string;
  public _defaultSource : string;

  public _includes : Include[]
  public _baseSource : string;
  public _joins: Join[]
  public context: Query

  static fromTable(tableName: string, tableOptions : TableOptions) : Query {
    let q = new Query();
    let as = tableOptions.as || tableName;

    q.dataSources = {}
    q._name = q.dataSources[as] = tableName;
    q._baseSource = q._defaultSource = as;
    q._substitutions = [];
    q._whereClauses = [];
    q._orderByClause = null;
    q._selectExpressions = [
        (row : Row) => tableOptions.columnNames.map(c => (<Selection>{
          expression: row.col(as, c),
          as: null,
        }))
    ];
    q._joins = [];
    q._includes = [];
    q.context = null;
    return q;
  }

  protected constructor() {
  }

  public clone() : Query {
    let clone = new Query();
    _.assign(clone, {
      dataSources: _.clone(this.dataSources),
      _baseSource: _.clone(this._baseSource),
      _defaultSource: _.clone(this._defaultSource),
      _substitutions: _.clone(this._substitutions),
      _whereClauses: _.clone(this._whereClauses),
      _orderByClause: _.clone(this._orderByClause),
      _selectExpressions: _.clone(this._selectExpressions),
      _joins: _.clone(this._joins),
      _includes: _.clone(this._includes),
      context: this.context
    })
    return clone;
  }

  // public applySubstitutions(substitutions) : Query {
  //   let clone = this.clone();
  //   clone._substitutions = clone._substitutions.concat([substitutions]);
  //   return clone;
  // }

  public where(whereClause: WhereClause) : Query {
    let clone = this.clone();
    clone._whereClauses.push(whereClause);
    return clone;
  }

  public orderBy(orderByClause: OrderByParam) : Query {
    // Obviously, only one orderByClause can be in effect...
    let clone = this.clone();
    clone._orderByClause = (row: Row) => {
      return orderByClause(row).map(expr => {
        if (expr instanceof Expression) {
          return <OrderBy>{
            expression: expr,
            order: OrderType.ASC
          }
        } else {
          return <OrderBy>{
            expression: expr[0],
            order: expr[1]
          }
        }
      })
    };
    return clone;
  }

  public selectNone() : Query {
    let clone = this.clone();
    clone._selectExpressions = [];
    return clone;
  }

  public select(selectParam : SelectParam) : Query {
    let clone = this.clone();
    clone._selectExpressions.push((row: Row) => {
      return selectParam(row).map(expr => {
        if (expr instanceof Expression) {
          return <Selection>{
            expression: expr,
            as: null
          };
        } else {
          return <Selection> {
            expression: expr[0],
            as: expr[1]
          }
        }
      })
    });
    return clone;
  }

  public name(name: string) {
    let clone = this.clone();
    clone._name = name;
    return clone;
  }

  public _generateNewReference(reference : string) : string {
    for (var i=0; i<1000; i++) {
      if (! this._resolveSource(`${reference}{$i}`) ) {
        return `${reference}${i}`
      }
    }
  }

  public _resolveSource(source: string) : Query | string {
    for (let current : Query = this; current != null; current = current.context) {
      if (current.dataSources[source]) {
        return current.dataSources[source];
      }
    }
    return null;
  }

  public join(target: Query | string, options : JoinOptions) : Query {
    let clone = this.clone();
    let joinType = options.type || JoinType.INNER;

    // Determine if the target is a simple table query, or something
    // more complex
    if (typeof target == 'string') {
      // Because we know this is a pure table query (without nasty
      // WHEREs that will render the LEFT/RIGHT/FULL OUTER joins invalid)

      let tableName = target;
      let as = options.as || tableName;

      assert(!this._resolveSource(as), `Alias ${as} has already been used`)

      clone.dataSources[as] = tableName;
      clone._joins.push(<Join>{
        dataSource: as,
        on: options.on,
        as: as,
        type: joinType
      })
    } else {
      let targetDataSources = target.dataSources;
      let keys = Object.keys(targetDataSources);

      // TODO: check in the related tables for on clauses

      if (keys.length == 1 && typeof targetDataSources[keys[0]] == 'string'
            && (joinType === JoinType.INNER || target._whereClauses.length === 0)
          ) {
        // table
        // Here we optimize this by not doing a rather stupid
        // However this will only work for INNER JOIN
        //
        // WITH newReference
        //  AS (SELECT * FROM originalReference)
        // ... FROM ... JOIN newReference
        //
        let tableName = targetDataSources[keys[0]];
        let as = options.as || target._name;

        assert(!this._resolveSource(as), `Alias ${as} has already been used`)

        clone.dataSources[as] = tableName;

        let conflicts = _.intersection(keys, Object.keys(this.dataSources));
        let substitutions = conflicts.map(originalReference => [
          originalReference,
          this._generateNewReference(originalReference)
        ])
        let substitutionsMap = _.fromPairs(<[string, string][]> substitutions);

        clone._whereClauses = clone._whereClauses.concat(
          target._whereClauses.map(whereClause => (row: Row) =>
            whereClause(row.applySubstitutions(substitutionsMap)))
          );

        clone._selectExpressions = clone._selectExpressions.concat(
          target._selectExpressions.map(selectExpr => (row: Row) =>
            selectExpr(row.applySubstitutions(substitutionsMap))
              .map(sel => <Selection>{
                expression: sel.expression,
                as: `${as}.${sel.as}`
              })
        ))

        // merge that query and this query
        /** check for naming conflicts. if yes (or if 'as' is different from
          data source name), wrap substitutions
          around: WHERE, SELECT. ORDER BY is irrelevant.  */
      } else {
        // complex query -- no issue with renaming since
        // it is part of a WITH query
        let as = options.as || target._name;

        // FIXME: for all dependencies of target, subsitute with some other
        // name

        assert(!this._resolveSource(as), `Alias ${as} has already been used`)

        clone._selectExpressions = clone._selectExpressions.concat(
          target._selectExpressions.map(selectExpr => row => {
            let selection = selectExpr(row.applySubstitutions({/* FIXME */}))
            return selection.map(sel => <Selection>{
              expression: sel.expression,
              as: `${as}.${sel.as}`
            })
          }));

        clone._joins.push(<Join>{
          dataSource: target,
          on: options.on,
          as : as,
          type: joinType
        })
        clone.dataSources[as] = target;
      }
    }
    return clone;
  }

  public include() : Query {
    throw new Error("Unimplemented");
  }

  /** WATCH OUT! This function has side effects **/
  private _generateAlias(source : string, used : {[source: string]: boolean}) {
    if (!(source in used)) return source;
    for (let i=0; i<1000; i++) {
      let candidate = `${source}_${i}`
      if (!(candidate in used)) {
        used[candidate] = true;
        return candidate;
      }
    }
    throw new Error("No free identifier found!");
  }
  public _withDependencies(usedIdentifiers : {[source: string]: boolean}) : [string, string, Query | string][] {
    let immediateWithDependencies = Object.keys(this.dataSources)
      // .filter(sourceName => this.dataSources[sourceName] instanceof Query)
      .map(sourceName => [
        sourceName,
        this._generateAlias(sourceName, usedIdentifiers),
        this.dataSources[sourceName]
      ])

    let parentDependencies : any = _(this.dataSources)
      .values()
      .filter(source => source instanceof Query)
      .map((query : any) => query._withDependencies(usedIdentifiers))
      .flatten()
      .value();

    let allDependencies = parentDependencies.concat(immediateWithDependencies);

    return allDependencies;
  }

  private _toSQL(dataSourceIdentifierMap : {[source: string]: string}) : string {
    let row = new Row(this);
    let selectionPart = _(this._selectExpressions)
      .map(sexpr => sexpr(row))
      .flatten()
      .map(sexpr => {
        let {expression, as} = <Selection>sexpr;
        if (as) {
          return `${expression.toSQL(dataSourceIdentifierMap)} AS "${as}"`;
        } else {
          return `${expression.toSQL(dataSourceIdentifierMap)}`;
        }
      })
      .join(',\n    ');

    function esc(col) {
      return `"${col}"`
    }

    let fromPart = esc(dataSourceIdentifierMap[this._baseSource]) + " "
      + this._joins.map(join => {
        let joinSpec = join.type == JoinType.INNER ? 'INNER JOIN'
                      :join.type == JoinType.OUTER ? 'OUTER JOIN'
                      :join.type == JoinType.LEFT ? 'LEFT JOIN'
                      :join.type == JoinType.RIGHT ? 'RIGHT JOIN'
                      :'??UNKNOWN JOIN??';

        let tableName = esc(dataSourceIdentifierMap[join.as])

        let conditions = join.on(row).toSQL(dataSourceIdentifierMap);

        return `\n    ${joinSpec} ${tableName} ON ${conditions}`
      }).join('');

    let wherePart = _(this._whereClauses)
      .map(sexpr => sexpr(row).toSQL(dataSourceIdentifierMap))
      .join(' AND\n    ')

    wherePart = wherePart ? `WHERE ${wherePart}` : wherePart

      return `SELECT
    ${selectionPart}
  FROM
    ${fromPart}
  ${wherePart}`
  }

  public toSQL() : string {
    let withDependencies = this._withDependencies({});
    let sourceAliasMap = <{[src: string]: string}>(_(withDependencies)
      .map(t => [t[0], t[1]])
      .fromPairs()
      .value());
    let withList = withDependencies
      .filter(([src, alias, query]) => query instanceof Query)
    let coreSQL = this._toSQL(sourceAliasMap)

    let withPart = _.size(withList) > 0 ? "WITH " +
      withList
        .map(([src, alias, query]) =>
          `${alias} AS (${(<Query>query)._toSQL(sourceAliasMap)})`
        ) : '';

    return withPart + coreSQL;
  }

  public get(sequelize : any) {
    return sequelize.query(this.toSQL(), {
      type: sequelize.QueryTypes.SELECT
    })
  }

}

export type SourceReferenceSubstitutions = {[originalReference: string] : string};
export type ExpressionFn = (Row) => Expression;
export type WhereClause = ExpressionFn;
export enum OrderType {
  ASC = 1,
  DESC = -1,
};

export interface OrderBy {
  expression: Expression,
  order: OrderType,
};
export type OrderByClause = (Row) => (OrderBy[]);
export type OrderByParam = ((Row) => (Expression | [Expression, OrderType])[])
/* Because select expressions can take an optional "AS" */
export interface Selection {
  expression: Expression,
  as: string | void
};
export type SelectExpression = ((Row) => Selection[]);
export type SelectParam = ((Row) => (Expression | [Expression, string])[])
export interface IncludeOptions {
  as?: string,
  on: (Row) => Expression
}
export enum JoinType {
  INNER = 0,
  OUTER = 1,
  LEFT = 2,
  RIGHT = 3,
}
export interface JoinOptions {
  as?: string,
  on: (Row) => Expression,
  type: JoinType
}
/* Currently include only allows joining to primary key */
export interface IncludeOptions {
  as? : string,
  on: (Row) => Expression
}
export interface TableOptions {
  as? : string,
  columnNames : string[]
}
export interface Join {
  dataSource: string | Query,
  as: string,
  on: ExpressionFn,
  type?: JoinType,
}
export interface Include {
  dataSource: string | Query,
  on: ExpressionFn,
}
export type DataSourceIdentifierMap = {[source: string]: string};
