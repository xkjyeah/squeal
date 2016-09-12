import {RowSource, Row} from './RowSource';
import {Value, Expression} from './Expression';
import {Table} from './Model';

function v(value) {
  return new Value(value);
}

// Basic select
var Blah = new Table('blah');
var rowSource = RowSource.fromTable(Blah)
console.log('SELECT * FROM blah:')
console.log(rowSource.toSQL());

rowSource = rowSource.where(
  (blah: Row) : Expression => blah.col('x').eq(100)

  // Using a predefined schema, we could define blah.x preemptively.
  // Without the typings, it could look something like:
  // blah => blah.x .eq (100)
);
console.log('SELECT * FROM blah WHERE blah.x = 100:')
console.log(rowSource.toSQL());

rowSource = rowSource.select(['col1', 'col2', {selection: 'col3', as: 'bar'}]);
console.log('SELECT col1, col2, col3 as bar FROM blah WHERE blah.x = 100:')
console.log(rowSource.toSQL());

// More complicated select (with fetching)
var Trip = new Table('table')
var Stop = new Table('stop')

Trip.hasMany(Stop)
Stop.belongsTo(Trip)

var trips = RowSource.fromTable(Trip)
var earlyTrips = trips.where(
  (trip: Row) : Expression => trip.fetch(Stop).col('x').min() .lt ('07:00')
)
.where(
  (trip: Row) : Expression => trip.fetch(Stop).col('x').min() .gt ('05:00')
)
console.log(earlyTrips.toSQL());
