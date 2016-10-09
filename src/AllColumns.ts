import {UnaryOp, QueryExpression, Expression} from './Expression';
import {Query} from './Query'

export class AllColumns extends Expression {
  public context : Query;
  public sourceName : string;

  constructor (context : Query, sourceName: string) {
    super();
    this.context = context;
    this.sourceName = sourceName;
  }

  public toSQL() {
    return `"${this.context._resolveSource(this.sourceName)}".*`
  }
}
