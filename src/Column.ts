import {UnaryOp, QueryExpression, Expression} from './Expression';
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
  toSQL() {
    return `"${this.context.resolveSource(this.sourceName)}"."${this.colName}"`
  }

  _constructSummary(sqlFunc: string) : Expression {
    let summarized = new Query(this.context);
    summarized.selected = [
      (row: Row) =>
        new UnaryOp(
          sqlFunc + '(',
          row.col(this.sourceName, this.colName),
          ')')
    ]
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
