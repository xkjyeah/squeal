import * as Lab from 'lab';
import * as expect from 'must';

import {RowSource} from '../src/RowSource.ts';
import {Table} from '../src/Table.ts';
import {Query} from '../src/Query.ts';

export const lab = Lab.script();

expect.prototype.fuzz = function (sql2) {
  const fuzzed_sql1 = (" " + this.actual + " ").replace(/[\r\n \t]+/g, ' ');
  const fuzzed_sql2 = (" " + sql2 + " ").replace(/[\r\n \t]+/g, ' ');

  return expect(fuzzed_sql1).equal(fuzzed_sql2);
}

lab.experiment('Basic', () => {
  var Foo, Bar;

  lab.before(async function() {
    Foo = new Table('foo');
    Bar = new Table('bar');

    Foo.hasMany(Bar);
    Bar.belongsTo(Foo);
  });

  lab.test('Table select', async function () {
    var query = Query.fromRowSource(Foo).toSQL();

    expect(query).fuzz('SELECT * FROM "foo" AS "foo"')
  });

});
