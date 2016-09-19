/// <reference path="../typings/index.d.ts" />
import * as assert from 'assert';
import {Context, Query} from './Query';

export abstract class Expression {
  abstract toSQL() : string;

  plus(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') + (', ')'],
      this, toExpression(that)
    )
  }

  minus(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') - (', ')'],
      this, toExpression(that)
    )
  }

  gt(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') > (', ')'],
      this, toExpression(that)
    )
  }

  lt(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') < (', ')'],
      this, toExpression(that)
    )
  }

  gte(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') >= (', ')'],
      this, toExpression(that)
    )
  }

  lte(that : ExpressionLike) {
    return new BinaryOp(
      ['(', ') <= (', ')'],
      this, toExpression(that)
    )
  }

  ne(that : ExpressionLike) {
    return new BinaryOp(
      '(#) <> (#)'.split('#'),
      this, toExpression(that)
    )
  }

  eq(that : ExpressionLike) {
    return new BinaryOp(
      '(#) = (#)'.split('#'),
      this, toExpression(that)
    )
  }

  and(that : ExpressionLike) {
    return new BinaryOp(
      '(#) AND (#)'.split('#'),
      this, toExpression(that)
    )
  }

  or(that : ExpressionLike) {
    return new BinaryOp(
      '(#) OR (#)'.split('#'),
      this, toExpression(that)
    )
  }
}

export function not(that: Expression) : UnaryOp {
  return new UnaryOp('NOT (', that, ')')
}

export function neg(that: Expression) : UnaryOp {
  return new UnaryOp('-(', that, ')')
}

/** An expression whose value is derived from an
    SQL subquery */
export class QueryExpression extends Expression {
  public query: Query;
  constructor(query: Query) {
    super();
    this.query = query;
  }
  toSQL() {
    return `(${this.query.toSQL()})`.replace(/\n/g, '\n    ');
  }
}

/** An SQL literal */
export class Value extends Expression {
  public value : string;
  constructor (value : string) {
    super();
    this.value = value;
  }
  toSQL() : string {
    return this.value;
  }
}

export class UnaryOp extends Expression {
  public before : string;
  public after : string;
  public operand : Expression;
  constructor (before : string, operand : Expression, after : string) {
    super();
    this.before = before;
    this.after = after;
    this.operand = operand;
  }
  toSQL() : string {
    return this.before + this.operand.toSQL() + this.after;
  }
}

export class BinaryOp extends Expression {
  public parts : string[];
  public op1 : Expression;
  public op2 : Expression;

  constructor (parts : string[], op1 : Expression, op2 : Expression) {
    super();
    this.parts = parts;
    this.op1 = op1;
    this.op2 = op2;
    assert.strictEqual(parts.length, 3);
  }
  toSQL() : string {
    return [
      this.parts[0],
      this.op1.toSQL(),
      this.parts[1],
      this.op2.toSQL(),
      this.parts[2]
    ].join('');
  }
}

export type ExpressionLike = Expression | number | string | Date;

export function toExpression(v: ExpressionLike) : Expression {
  function escape(s) {
    return s.replace(/'/g, "''");
  }
  function failure() : Value {
    throw new Error();
  }

  return (v instanceof Expression) ? v
    : (v instanceof Date) ? new Value(`"${v.toISOString()}"`)
    : (typeof v === 'string') ? new Value(`"${escape(v)}"`)
    : (typeof v === 'number') ? new Value(v.toString())
    : failure();
}

export function literal(v: string) : Expression {
  return new Value(v);
}
