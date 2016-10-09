import {UnaryOp, QueryExpression, Expression, DataSourceIdentifierMap} from './Expression';
import {Query} from './Query';
import {Row} from './Row';

export class Column extends Expression {
  // FIXME: what if this context turns stale?
  public context : Query;
  public sourceName : string;
  public colName : string;

  constructor (context : Query, sourceName: string, colName: string) {
    super();
    this.context = context;
    this.sourceName = sourceName;
    this.colName = colName;
  }

  toSQL(aliases : DataSourceIdentifierMap) {
    return `"${aliases[this.sourceName]}"."${this.colName}"`
  }

  _constructSummary(sqlFunc: string) : Expression {
    let summarized = this.context
      .selectNone()
      .select((row) => [
        [new UnaryOp(
          sqlFunc + '(',
          row.col(this.sourceName, this.colName),
          ')'), 'sqlFunc']
      ])
    return new QueryExpression(summarized);
  }

  min() : Expression {
    return this._constructSummary('MIN');
  }
  max() : Expression {
    return this._constructSummary('MAX');
  }
  sum() : Expression {
    return this._constructSummary('SUM');
  }
  count() : Expression {
    return this._constructSummary('COUNT');
  }
  mean() : Expression {
    return this._constructSummary('AVERAGE');
  }
}
