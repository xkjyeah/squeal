import {RowSource} from './RowSource';
import {Query} from './Query';

export class QueryRowSource extends RowSource {
  public query: Query;

  constructor(name: string, query: Query) {
    super(name);
    this.query = query;
  }
}
