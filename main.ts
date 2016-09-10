import {RowSource, Row} from './RowSource';
import {Value, Expression} from './Expression';

function v(value) {
  return new Value(value);
}

// Basic select
var rowSource = RowSource.fromTable('blah')
console.log('SELECT * FROM blah:')
console.log(rowSource.toSQL());

rowSource = rowSource.where(
  (blah: Row) : Expression => blah.col('x').eq(100)
);
console.log('SELECT * FROM blah WHERE blah.x = 100:')
console.log(rowSource.toSQL());
