/// <reference path="typings/index.d.ts" />
import * as assert from 'assert';
import {Context, RowSource} from './RowSource';

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
}

export function not(that: Expression) : UnaryOp {
  return new UnaryOp('NOT (', that, ')')
}

export function neg(that: Expression) : UnaryOp {
  return new UnaryOp('-(', that, ')')
}

export class Column extends Expression {
  public context : Context;
  public sourceName : string;
  public colName : string;
  constructor (context : RowSource, sourceName: string, colName: string) {
    super();
    this.context = context;
    this.sourceName = sourceName;
    this.colName = colName;
  }
  toSQL() {
    return `"${this.context.resolveSource(this.sourceName)}".${this.colName}`
  }
}

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
    assert.strictEqual(parts.length, 3);
  }
  toSQL() : string {
    return [
      this.parts[0],
      this.op1,
      this.parts[1],
      this.op2,
      this.parts[2]
    ].join('');
  }
}

type ExpressionLike = Expression | number | string | Date;

export function toExpression(v: ExpressionLike) : Expression {
  function escape(s) {
    return s.replace(/'/g, "''");
  }
  function failure() : Value {
    throw new Error();
  }

  return (v instanceof Expression) ? v
    : (v instanceof Date) ? new Value(`"${v.toISOString()}"`)
    : (typeof v === 'string') ? new Value(escape(v))
    : (typeof v === 'number') ? new Value(v.toString())
    : failure();
}
